import { MatchStatus, MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { almostThere } from "@/lib/almost-there";
import { loadAchievements } from "@/lib/load-achievements";
import { loadWinStreak } from "@/lib/load-win-streak";
import { loadMonthlyStandings } from "@/lib/load-monthly-leaderboard";
import { MONTHLY_MIN_MATCHES, recentMonths } from "@/lib/monthly-leaderboard";

/** The signed-in player's nearest goals for the dashboard's "Almost there" card. */
export async function loadAlmostThere(userId: string) {
  const [user, matches, streak, achievements, memberships] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { skillRating: true } }),
    prisma.match.count({ where: { status: MatchStatus.COMPLETED, deletedAt: null, players: { some: { userId } } } }),
    loadWinStreak(userId, null),
    loadAchievements(userId),
    prisma.membership.findMany({ where: { userId, status: MembershipStatus.ACTIVE }, select: { groupId: true, group: { select: { name: true } } } }),
  ]);
  if (!user) return [];
  const [thisMonth] = recentMonths(new Date(), 1);
  const monthly = await Promise.all(memberships.map(async (membership) => {
    const [month] = await loadMonthlyStandings(membership.groupId, [thisMonth]);
    const mine = [...month.ranked, ...month.unranked].find((entry) => entry.userId === userId);
    return { groupId: membership.groupId, groupName: membership.group.name, matches: mine?.matches ?? 0, minMatches: MONTHLY_MIN_MATCHES };
  }));
  return almostThere({ userId, rating: Number(user.skillRating), matches, currentStreak: streak.current, bestStreak: streak.best, achievements, monthly });
}
