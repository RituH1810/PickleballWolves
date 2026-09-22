import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      memberships: { where: { status: MembershipStatus.ACTIVE }, orderBy: { joinedAt: "asc" }, include: { user: { select: { id: true, name: true, skillRating: true } } } },
      events: { where: { status: "PUBLISHED", startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 6 },
    },
  });
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  const myMembership = user ? group.memberships.find((membership) => membership.userId === user.id) : undefined;

  const memberIds = group.memberships.map((membership) => membership.userId);
  const completedMatches = memberIds.length
    ? await prisma.match.findMany({ where: { status: "COMPLETED", deletedAt: null, players: { some: { userId: { in: memberIds } } } }, include: { players: true, scores: true } })
    : [];
  const leaderboard = group.memberships
    .map((membership) => {
      const matches = completedMatches.filter((match) => match.players.some((matchPlayer) => matchPlayer.userId === membership.userId));
      let wins = 0;
      let totalDiff = 0;
      matches.forEach((match) => {
        const currentPlayer = match.players.find((matchPlayer) => matchPlayer.userId === membership.userId);
        const diff = match.scores.reduce((total, score) => total + (currentPlayer?.side === "A" ? score.sideAScore - score.sideBScore : score.sideBScore - score.sideAScore), 0);
        if (diff > 0) wins += 1;
        totalDiff += diff;
      });
      const losses = Math.max(0, matches.length - wins);
      return { id: membership.user.id, name: membership.user.name, rating: membership.user.skillRating.toString(), wins, losses, winPct: matches.length ? Math.round((wins / matches.length) * 100) : 0, avgPointDiff: matches.length ? Number((totalDiff / matches.length).toFixed(1)) : 0 };
    })
    .sort((a, b) => b.winPct - a.winPct || b.avgPointDiff - a.avgPointDiff)
    .map((entry, index) => ({ rank: index + 1, ...entry }));

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      location: group.location,
      description: group.description,
      memberCount: group.memberships.length,
      members: group.memberships.map((membership) => ({ id: membership.user.id, name: membership.user.name, skillRating: membership.user.skillRating.toString(), role: membership.role })),
      leaderboard,
      events: group.events.map((event) => ({ id: event.id, title: event.title, startsAt: event.startsAt, location: event.location, format: event.format })),
      isMember: Boolean(myMembership),
      myRole: myMembership?.role ?? null,
    },
  });
}
