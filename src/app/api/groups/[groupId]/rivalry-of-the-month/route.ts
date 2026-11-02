import { NextResponse } from "next/server";
import { MembershipStatus, MatchStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { recentMonths } from "@/lib/monthly-leaderboard";
import { computeMonthlyRivalry } from "@/lib/monthly-rivalry";

// The group's closest head-to-head this month (or last month, until this month has one). Members only.
export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  if (membership?.status !== MembershipStatus.ACTIVE) return NextResponse.json({ error: "Join this group to see its rivalries." }, { status: 403 });

  for (const month of recentMonths(new Date(), 2)) {
    const matches = await prisma.match.findMany({
      where: { status: MatchStatus.COMPLETED, deletedAt: null, roundRobin: { groupId }, updatedAt: { gte: month.start, lt: month.end }, scores: { some: {} } },
      select: { id: true, updatedAt: true, winnerSide: true, players: { select: { userId: true, side: true, user: { select: { name: true, isGuest: true, photoUrl: true } } } }, scores: { select: { gameNumber: true, sideAScore: true, sideBScore: true } } },
    });
    const guestIds = new Set(matches.flatMap((match) => match.players.filter((player) => player.user.isGuest).map((player) => player.userId)));
    const rivalry = computeMonthlyRivalry(matches.map((match) => ({ ...match, playedAt: match.updatedAt })), guestIds);
    if (!rivalry) continue;
    const people = new Map(matches.flatMap((match) => match.players.map((player) => [player.userId, { userId: player.userId, name: player.user.name, photoUrl: player.user.photoUrl }] as const)));
    return NextResponse.json({ rivalry: { ...rivalry, month: month.label, isCurrent: month.isCurrent, playerA: people.get(rivalry.a), playerB: people.get(rivalry.b) } });
  }
  return NextResponse.json({ rivalry: null });
}
