import { prisma } from "@/lib/prisma";
import { loadAchievements } from "@/lib/load-achievements";
import { loadPlayerRecaps } from "@/lib/load-recap";
import type { BragCard } from "@/lib/brag";
import type { Achievement } from "@/lib/achievements";
import { ordinal, type PlayerRecap } from "@/lib/round-robin-recap";

export type BragView =
  | { kind: "achievement"; playerName: string; achievement: Achievement & { unlockedAt: Date } }
  | { kind: "recap"; playerName: string; roundRobinName: string; groupName: string | null; endedAt: Date; recap: PlayerRecap };

/**
 * What a brag card shows, worked out fresh from the player's history -- or null if it no longer
 * holds (the badge isn't earned, or the round robin isn't over or they didn't play in it).
 */
export async function loadBragView(card: BragCard): Promise<BragView | null> {
  const player = await prisma.user.findUnique({ where: { id: card.userId }, select: { name: true } });
  if (!player) return null;

  if (card.kind === "achievement") {
    const achievement = (await loadAchievements(card.userId)).find((entry) => entry.id === card.achievementId);
    if (!achievement?.unlocked || !achievement.unlockedAt) return null;
    return { kind: "achievement", playerName: player.name, achievement: { ...achievement, unlockedAt: achievement.unlockedAt } };
  }

  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: card.roundRobinId }, select: { name: true, status: true, completedAt: true, createdAt: true, group: { select: { name: true } } } });
  if (roundRobin?.status !== "COMPLETED") return null;
  const recap = (await loadPlayerRecaps(card.roundRobinId)).get(card.userId);
  if (!recap) return null;
  return { kind: "recap", playerName: player.name, roundRobinName: roundRobin.name, groupName: roundRobin.group?.name ?? null, endedAt: roundRobin.completedAt ?? roundRobin.createdAt, recap };
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" };

export function bragDate(date: Date) {
  return date.toLocaleDateString("en-US", DATE_FORMAT);
}

/** One line for the link preview and share message, e.g. "Asha won Saturday Round Robin (5-1, +23)". */
export function bragHeadline(view: BragView) {
  if (view.kind === "achievement") return `${view.playerName} unlocked ${view.achievement.name}`;
  const { recap } = view;
  const record = `${recap.wins}-${recap.losses}, ${recap.differential > 0 ? "+" : ""}${recap.differential}`;
  return recap.champion ? `${view.playerName} won ${view.roundRobinName} (${record})` : `${view.playerName} finished ${ordinal(recap.rank)} of ${recap.players} at ${view.roundRobinName} (${record})`;
}
