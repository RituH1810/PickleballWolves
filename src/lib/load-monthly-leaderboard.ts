import { MatchStatus, MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeMonthlyLeaderboard, monthOf, type LeaderboardMatch, type MonthWindow } from "@/lib/monthly-leaderboard";

/**
 * A group's standings for each of `months` (members only, ranked by win % then point difference),
 * shared by the group page's monthly leaderboard and its share card.
 */
export async function loadMonthlyStandings(groupId: string, months: MonthWindow[]) {
  const [members, matches] = await Promise.all([
    prisma.membership.findMany({ where: { groupId, status: MembershipStatus.ACTIVE }, select: { user: { select: { id: true, name: true, photoUrl: true } } } }),
    prisma.match.findMany({
      // Bucketed by when the score was saved, the same clock monthly awards use.
      where: { status: MatchStatus.COMPLETED, deletedAt: null, roundRobin: { groupId }, updatedAt: { gte: months.at(-1)!.start, lt: months[0].end }, scores: { some: {} } },
      select: { updatedAt: true, players: { select: { userId: true, side: true } }, scores: { select: { sideAScore: true, sideBScore: true } } },
    }),
  ]);
  const people = new Map(members.map((member) => [member.user.id, member.user]));
  const memberIds = new Set(people.keys());
  const byMonth = new Map<string, LeaderboardMatch[]>(months.map((month) => [month.key, []]));
  for (const match of matches) {
    const key = monthOf(match.updatedAt, months);
    if (key) byMonth.get(key)!.push({ playedAt: match.updatedAt, players: match.players, scores: match.scores });
  }

  const withPerson = <T extends { userId: string }>(entry: T) => ({ ...entry, name: people.get(entry.userId)?.name ?? "Player", photoUrl: people.get(entry.userId)?.photoUrl ?? null });
  return months.map((month) => {
    const { ranked, unranked } = computeMonthlyLeaderboard(byMonth.get(month.key)!, memberIds);
    return { key: month.key, label: month.label, isCurrent: month.isCurrent, matchCount: byMonth.get(month.key)!.length, ranked: ranked.map(withPerson), unranked: unranked.map(withPerson) };
  });
}
