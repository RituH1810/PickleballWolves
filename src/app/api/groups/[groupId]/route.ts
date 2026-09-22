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
      roundRobins: { where: { status: { in: ["SETUP", "LIVE"] }, scheduledAt: { gte: new Date() } }, orderBy: { scheduledAt: "asc" }, take: 6 },
    },
  });
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  const myMembership = user ? group.memberships.find((membership) => membership.userId === user.id) : undefined;
  const myAnyMembership = user ? await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } }) : null;

  let pendingRequests: { id: string; name: string }[] = [];
  if (myMembership && myMembership.status === MembershipStatus.ACTIVE) {
    const requests = await prisma.membership.findMany({ where: { groupId, status: MembershipStatus.PENDING }, include: { user: { select: { id: true, name: true } } } });
    pendingRequests = requests.map((request) => ({ id: request.user.id, name: request.user.name }));
  }

  // Scope to matches actually played as part of this group's own events or round robins --
  // not just any match a member happened to play anywhere on the platform.
  const completedMatches = await prisma.match.findMany({
    where: { status: "COMPLETED", deletedAt: null, OR: [{ event: { groupId } }, { roundRobin: { groupId } }] },
    include: { players: { include: { user: { select: { name: true } } } }, scores: true },
  });

  const recentResults = [...completedMatches]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
    .map((match) => ({
      id: match.id,
      sideA: match.players.filter((player) => player.side === "A").map((player) => player.user.name).join(" / "),
      sideB: match.players.filter((player) => player.side === "B").map((player) => player.user.name).join(" / "),
      score: match.scores.map((score) => `${score.sideAScore} - ${score.sideBScore}`).join(", "),
      winnerSide: match.winnerSide,
      date: match.scheduledAt ?? match.createdAt,
    }));
  const leaderboard = group.memberships
    .map((membership) => {
      const matches = completedMatches.filter((match) => match.players.some((matchPlayer) => matchPlayer.userId === membership.userId));
      let wins = 0;
      let scored = 0;
      let conceded = 0;
      matches.forEach((match) => {
        const currentPlayer = match.players.find((matchPlayer) => matchPlayer.userId === membership.userId);
        const myScore = match.scores.reduce((total, score) => total + (currentPlayer?.side === "A" ? score.sideAScore : score.sideBScore), 0);
        const theirScore = match.scores.reduce((total, score) => total + (currentPlayer?.side === "A" ? score.sideBScore : score.sideAScore), 0);
        scored += myScore;
        conceded += theirScore;
        if (myScore > theirScore) wins += 1;
      });
      const losses = Math.max(0, matches.length - wins);
      const totalDiff = scored - conceded;
      return { id: membership.user.id, name: membership.user.name, rating: membership.user.skillRating.toString(), wins, losses, winPct: matches.length ? Math.round((wins / matches.length) * 100) : 0, scored, conceded, avgPointDiff: matches.length ? Number((totalDiff / matches.length).toFixed(1)) : 0 };
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
      members: group.memberships
        .map((membership) => ({ id: membership.user.id, name: membership.user.name, skillRating: membership.user.skillRating.toString(), role: membership.role, rank: leaderboard.find((entry) => entry.id === membership.user.id)?.rank ?? null }))
        .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)),
      leaderboard,
      recentResults,
      events: group.events.map((event) => ({ id: event.id, title: event.title, startsAt: event.startsAt, location: event.location, format: event.format })),
      roundRobins: group.roundRobins.map((roundRobin) => ({ id: roundRobin.id, name: roundRobin.name, scheduledAt: roundRobin.scheduledAt, playFormat: roundRobin.playFormat, partnerFormat: roundRobin.partnerFormat })),
      isMember: Boolean(myMembership),
      myRole: myMembership?.role ?? null,
      myStatus: myAnyMembership?.status ?? null,
      pendingRequests,
    },
  });
}
