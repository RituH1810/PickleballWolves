import { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadAchievements } from "@/lib/load-achievements";
import { loadPlayerRecaps, loadRecap } from "@/lib/load-recap";
import { loadMonthlyStandings } from "@/lib/load-monthly-leaderboard";
import { monthWindow } from "@/lib/monthly-leaderboard";
import { isRoundRobinParticipant } from "@/lib/round-robin-access";
import type { BragCard } from "@/lib/brag";
import type { Achievement } from "@/lib/achievements";
import { ordinal, type PlayerRecap } from "@/lib/round-robin-recap";

// How many places the leaderboard card lists.
export const LEADERBOARD_CARD_PLACES = 5;

type Place = { rank: number; name: string; wins: number; losses: number };

export type BragView =
  | { kind: "achievement"; playerName: string; achievement: Achievement & { unlockedAt: Date } }
  | { kind: "recap"; playerName: string; roundRobinName: string; groupName: string | null; endedAt: Date; recap: PlayerRecap }
  | { kind: "roundRobin"; roundRobinName: string; groupName: string | null; endedAt: Date; champions: Place[]; podium: (Place & { differential: number })[]; undefeated: boolean; totals: { players: number; games: number; points: number } }
  | { kind: "leaderboard"; groupName: string; monthLabel: string; isCurrent: boolean; places: (Place & { winPct: number })[] };

async function isActiveMember(groupId: string, userId: string) {
  const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId } }, select: { status: true } });
  return membership?.status === MembershipStatus.ACTIVE;
}

/**
 * What a card shows, worked out fresh -- or null if it no longer holds: the badge isn't earned, the
 * round robin isn't over, or the player who shared it can no longer see what they shared.
 */
export async function loadBragView(card: BragCard): Promise<BragView | null> {
  const player = await prisma.user.findUnique({ where: { id: card.userId }, select: { name: true } });
  if (!player) return null;

  if (card.kind === "achievement") {
    const achievement = (await loadAchievements(card.userId)).find((entry) => entry.id === card.achievementId);
    if (!achievement?.unlocked || !achievement.unlockedAt) return null;
    return { kind: "achievement", playerName: player.name, achievement: { ...achievement, unlockedAt: achievement.unlockedAt } };
  }

  if (card.kind === "leaderboard") {
    const month = monthWindow(card.month);
    const group = await prisma.group.findUnique({ where: { id: card.groupId }, select: { name: true } });
    if (!month || !group || !(await isActiveMember(card.groupId, card.userId))) return null;
    const [standings] = await loadMonthlyStandings(card.groupId, [month]);
    if (!standings.ranked.length) return null;
    return {
      kind: "leaderboard",
      groupName: group.name,
      monthLabel: month.label,
      isCurrent: month.isCurrent,
      places: standings.ranked.slice(0, LEADERBOARD_CARD_PLACES).map((entry) => ({ rank: entry.rank, name: entry.name, wins: entry.wins, losses: entry.losses, winPct: Math.round(entry.winPct * 100) })),
    };
  }

  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: card.roundRobinId }, select: { name: true, status: true, createdById: true, groupId: true, completedAt: true, createdAt: true, group: { select: { name: true } } } });
  if (roundRobin?.status !== "COMPLETED") return null;
  const endedAt = roundRobin.completedAt ?? roundRobin.createdAt;

  if (card.kind === "recap") {
    const recap = (await loadPlayerRecaps(card.roundRobinId)).get(card.userId);
    if (!recap) return null;
    return { kind: "recap", playerName: player.name, roundRobinName: roundRobin.name, groupName: roundRobin.group?.name ?? null, endedAt, recap };
  }

  // The whole night's recap: anyone who could see the round robin can share it.
  const canSee = roundRobin.createdById === card.userId || await isRoundRobinParticipant(card.roundRobinId, card.userId) || (roundRobin.groupId ? await isActiveMember(roundRobin.groupId, card.userId) : false);
  if (!canSee) return null;
  const recap = await loadRecap(card.roundRobinId);
  if (!recap?.champions.length) return null;
  const place = (entry: { rank: number; name: string; wins: number; losses: number }) => ({ rank: entry.rank, name: entry.name, wins: entry.wins, losses: entry.losses });
  return {
    kind: "roundRobin",
    roundRobinName: roundRobin.name,
    groupName: roundRobin.group?.name ?? null,
    endedAt,
    champions: recap.champions.map(place),
    podium: recap.podium.map((entry) => ({ ...place(entry), differential: entry.differential })),
    undefeated: recap.undefeated,
    totals: recap.totals,
  };
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" };

export function bragDate(date: Date) {
  return date.toLocaleDateString("en-US", DATE_FORMAT);
}

const joinNames = (names: string[]) => names.join(" & ");

/** One line for the link preview and share message, e.g. "Asha won Saturday Round Robin (5-1, +23)". */
export function bragHeadline(view: BragView) {
  switch (view.kind) {
    case "achievement":
      return `${view.playerName} unlocked ${view.achievement.name}`;
    case "recap": {
      const { recap } = view;
      const record = `${recap.wins}-${recap.losses}, ${recap.differential > 0 ? "+" : ""}${recap.differential}`;
      return recap.champion ? `${view.playerName} won ${view.roundRobinName} (${record})` : `${view.playerName} finished ${ordinal(recap.rank)} of ${recap.players} at ${view.roundRobinName} (${record})`;
    }
    case "roundRobin":
      return `${joinNames(view.champions.map((entry) => entry.name))} ${view.champions.length > 1 ? "shared the win at" : "won"} ${view.roundRobinName}`;
    case "leaderboard":
      return `${view.groupName} · ${view.monthLabel} leaderboard: ${view.places[0].name} ${view.isCurrent ? "leads" : "finished on top"}`;
  }
}

/** The second line under the headline in link previews. */
export function bragDescription(view: BragView) {
  switch (view.kind) {
    case "achievement": return view.achievement.description;
    case "recap": return `${view.roundRobinName} on PickleballWolves`;
    case "roundRobin": return `${view.totals.players} players · ${view.totals.games} games · ${view.totals.points} points`;
    case "leaderboard": return `Top ${view.places.length} in ${view.groupName} for ${view.monthLabel}`;
  }
}
