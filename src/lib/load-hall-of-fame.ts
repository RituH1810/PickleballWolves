import { prisma } from "@/lib/prisma";
import { computeHallOfFame, topRoundRobinWinners, type HallOfFameRoundRobin } from "@/lib/hall-of-fame";
import { hallOfGrit, milestoneClubs, playerHallStats, recordChases, recordHistory, yourPlace } from "@/lib/hall-extras";
import { LEADERBOARD_TIME_ZONE, recentMonths } from "@/lib/monthly-leaderboard";
import { AWARD_LABELS, type AwardKind } from "@/lib/monthly-awards";
import { computeRecap } from "@/lib/round-robin-recap";

/** A group's ended round robins with their scored matches, plus which players are guests. Shared by the Hall of Fame and the activity feed. */
export async function loadGroupRoundRobins(groupId: string): Promise<{ roundRobins: HallOfFameRoundRobin[]; guestIds: Set<string> }> {
  const roundRobins = await prisma.roundRobin.findMany({
    where: { groupId, status: "COMPLETED", matches: { some: { deletedAt: null, scores: { some: {} } } } },
    select: {
      id: true,
      name: true,
      completedAt: true,
      createdAt: true,
      // Every scored match counts, like the recap; updatedAt (when the score was saved) orders them.
      matches: { where: { deletedAt: null, scores: { some: {} } }, select: { id: true, updatedAt: true, players: { select: { userId: true, side: true, user: { select: { name: true, isGuest: true } } } }, scores: { select: { gameNumber: true, sideAScore: true, sideBScore: true } } } },
    },
  });
  return {
    guestIds: new Set(roundRobins.flatMap((roundRobin) => roundRobin.matches.flatMap((match) => match.players.filter((player) => player.user.isGuest).map((player) => player.userId)))),
    roundRobins: roundRobins.map((roundRobin) => ({
      id: roundRobin.id,
      name: roundRobin.name,
      endedAt: roundRobin.completedAt ?? roundRobin.createdAt,
      matches: roundRobin.matches.map((match) => ({ id: match.id, playedAt: match.updatedAt, players: match.players.map((player) => ({ userId: player.userId, name: player.user.name, side: player.side })), scores: match.scores })),
    })),
  };
}

/** A month key ("2026-10") on the leaderboards' calendar. */
const monthKeyOf = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: LEADERBOARD_TIME_ZONE, year: "numeric", month: "2-digit" }).format(date).slice(0, 7);
const monthLabelOf = (key: string) => new Date(`${key}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** Every month's round robin champions, Players of the Week and monthly awards, newest month first. */
async function loadWallOfChampions(groupId: string, roundRobins: HallOfFameRoundRobin[], guestIds: Set<string>) {
  const [weeks, awards] = await Promise.all([
    prisma.playerOfTheWeek.findMany({ where: { groupId }, select: { weekStart: true, userId: true } }),
    prisma.monthlyAward.findMany({ where: { groupId }, select: { month: true, award: true, userId: true, detail: true } }),
  ]);
  const people = await prisma.user.findMany({ where: { id: { in: [...new Set([...weeks.map((week) => week.userId), ...awards.map((award) => award.userId)])] } }, select: { id: true, name: true } });
  const nameOf = new Map(people.map((person) => [person.id, person.name]));
  type Month = { key: string; label: string; champions: { roundRobin: { id: string; name: string }; players: { userId: string; name: string }[] }[]; playersOfTheWeek: { weekStart: Date; players: { userId: string; name: string }[] }[]; awards: { title: string; players: { userId: string; name: string }[]; detail: string }[] };
  const months = new Map<string, Month>();
  const month = (key: string) => months.get(key) ?? months.set(key, { key, label: monthLabelOf(key), champions: [], playersOfTheWeek: [], awards: [] }).get(key)!;
  for (const roundRobin of [...roundRobins].sort((a, b) => a.endedAt.getTime() - b.endedAt.getTime())) {
    const players = (computeRecap(roundRobin.matches)?.champions ?? []).filter((player) => !guestIds.has(player.userId)).map(({ userId, name }) => ({ userId, name }));
    if (players.length) month(monthKeyOf(roundRobin.endedAt)).champions.push({ roundRobin: { id: roundRobin.id, name: roundRobin.name }, players });
  }
  const weekGroups = new Map<string, { weekStart: Date; players: { userId: string; name: string }[] }>();
  for (const week of weeks) {
    const entry = weekGroups.get(week.weekStart.toISOString()) ?? { weekStart: week.weekStart, players: [] };
    entry.players.push({ userId: week.userId, name: nameOf.get(week.userId) ?? "Player" });
    weekGroups.set(week.weekStart.toISOString(), entry);
  }
  // A week belongs to the month it ends in (its Sunday).
  for (const entry of [...weekGroups.values()].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())) month(monthKeyOf(new Date(entry.weekStart.getTime() + 6 * 24 * 60 * 60 * 1000))).playersOfTheWeek.push(entry);
  const awardGroups = new Map<string, Month["awards"][number] & { month: string }>();
  for (const award of awards) {
    const key = `${award.month}:${award.award}`;
    const entry = awardGroups.get(key) ?? { month: award.month, title: AWARD_LABELS[award.award as AwardKind]?.title ?? award.award, players: [], detail: award.detail };
    entry.players.push({ userId: award.userId, name: nameOf.get(award.userId) ?? "Player" });
    awardGroups.set(key, entry);
  }
  for (const { month: key, ...award } of awardGroups.values()) month(key).awards.push(award);
  return [...months.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/**
 * A group's records and top 3 round robin winners from its ended round robins, with each player's
 * photo. `period: "month"` limits them to this month's nights; all-time also brings each record's
 * history, live record chases, the viewer's place on each record, milestone clubs, the Hall of
 * Grit and the wall of champions.
 */
export async function loadHallOfFame(groupId: string, { period = "all", viewerId = null }: { period?: "all" | "month"; viewerId?: string | null } = {}) {
  const loaded = await loadGroupRoundRobins(groupId);
  const { guestIds } = loaded;
  const thisMonth = recentMonths(new Date(), 1)[0];
  const roundRobins = period === "month" ? loaded.roundRobins.filter((roundRobin) => roundRobin.endedAt >= thisMonth.start && roundRobin.endedAt < thisMonth.end) : loaded.roundRobins;
  const records = computeHallOfFame(roundRobins, guestIds);
  const winners = topRoundRobinWinners(roundRobins, guestIds);

  const photos = await prisma.user.findMany({ where: { id: { in: [...records.flatMap((record) => record.holders.map((holder) => holder.userId)), ...winners.map((winner) => winner.userId)] } }, select: { id: true, photoUrl: true } });
  const photoOf = new Map(photos.map((user) => [user.id, user.photoUrl]));
  const base = {
    period,
    monthLabel: thisMonth.label,
    records: records.map((record) => ({ ...record, holders: record.holders.map((holder) => ({ userId: holder.userId, name: holder.name, photoUrl: photoOf.get(holder.userId) ?? null })) })),
    winners: winners.map((winner) => ({ ...winner, photoUrl: photoOf.get(winner.userId) ?? null })),
  };
  if (period === "month") return base;

  const stats = playerHallStats(roundRobins, guestIds);
  return {
    ...base,
    history: recordHistory(roundRobins, guestIds),
    chases: recordChases(stats, records),
    place: viewerId ? yourPlace(stats, viewerId) : [],
    clubs: milestoneClubs(roundRobins, guestIds),
    grit: hallOfGrit(roundRobins, stats),
    wall: await loadWallOfChampions(groupId, roundRobins, guestIds),
  };
}
