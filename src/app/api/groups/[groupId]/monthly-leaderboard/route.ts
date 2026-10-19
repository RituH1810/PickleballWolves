import { NextResponse } from "next/server";
import { MatchStatus, MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { computeMonthlyLeaderboard, monthOf, MONTHLY_MIN_MATCHES, recentMonths, type LeaderboardMatch } from "@/lib/monthly-leaderboard";

// The group's month-by-month leaderboard: this month (resets on the 1st) plus the two before it.
// Members only, like the rest of the group's results.
export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  if (membership?.status !== MembershipStatus.ACTIVE) return NextResponse.json({ error: "Join this group to see its leaderboard." }, { status: 403 });

  const months = recentMonths();
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
  return NextResponse.json({
    minMatches: MONTHLY_MIN_MATCHES,
    months: months.map((month) => {
      const { ranked, unranked } = computeMonthlyLeaderboard(byMonth.get(month.key)!, memberIds);
      return { key: month.key, label: month.label, isCurrent: month.isCurrent, matchCount: byMonth.get(month.key)!.length, ranked: ranked.map(withPerson), unranked: unranked.map(withPerson) };
    }),
  });
}
