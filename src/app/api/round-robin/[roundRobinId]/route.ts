import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const roundRobin = await prisma.roundRobin.findUnique({
    where: { id: roundRobinId },
    include: {
      group: { select: { id: true, name: true } },
      rsvps: { include: { user: { select: { id: true, name: true } } } },
      rounds: { orderBy: { roundNumber: "asc" }, include: { matches: { where: { deletedAt: null }, orderBy: { courtNumber: "asc" }, include: { players: { include: { user: { select: { id: true, name: true } } } }, scores: true } } } },
      // Matches created one-off via "Create match" instead of through generate/add-round --
      // they belong to the round robin directly but aren't attached to any numbered Round.
      matches: { where: { roundId: null, deletedAt: null }, orderBy: { courtNumber: "asc" }, include: { players: { include: { user: { select: { id: true, name: true } } } }, scores: true } },
    },
  });
  if (!roundRobin) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });

  // Group round robins are private to the group -- non-members (including logged-out
  // visitors) get the same "not found" response as a bad id, so we don't leak that a
  // group-only round robin exists to people outside the group.
  let isGroupMember = false;
  if (roundRobin.groupId) {
    const membership = user ? await prisma.membership.findUnique({ where: { groupId_userId: { groupId: roundRobin.groupId, userId: user.id } } }) : null;
    isGroupMember = Boolean(membership && membership.status === MembershipStatus.ACTIVE);
    if (!isGroupMember && roundRobin.createdById !== user?.id) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  }

  const organizer = await prisma.user.findUnique({ where: { id: roundRobin.createdById }, select: { name: true } });
  const hasScores = roundRobin.rounds.some((round) => round.matches.some((match) => match.scores.length > 0)) || roundRobin.matches.some((match) => match.scores.length > 0);

  const joinedPlayers = roundRobin.rsvps.filter((rsvp) => rsvp.status === "JOINED").map((rsvp) => ({ id: rsvp.user.id, name: rsvp.user.name }));
  const myRsvpStatus = user ? roundRobin.rsvps.find((rsvp) => rsvp.userId === user.id)?.status ?? null : null;

  return NextResponse.json({
    roundRobin: {
      ...roundRobin,
      organizerName: organizer?.name ?? "Unknown",
      isOwner: user ? roundRobin.createdById === user.id : false,
      hasScores,
      groupId: roundRobin.group?.id ?? null,
      groupName: roundRobin.group?.name ?? null,
      joinedPlayers,
      joinedCount: joinedPlayers.length,
      myUserId: user?.id ?? null,
      myRsvpStatus,
      isGroupMember,
      rounds: roundRobin.rounds.map((round) => ({ ...round, matches: round.matches.map((match) => ({ ...match, players: match.players.map((player) => ({ ...player, name: player.user.name })), scores: match.scores.map((score) => ({ ...score })) })) })),
      manualMatches: roundRobin.matches.map((match) => ({ ...match, players: match.players.map((player) => ({ ...player, name: player.user.name })), scores: match.scores.map((score) => ({ ...score })) })),
    },
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to edit this round robin." }, { status: 401 });
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId } });
  if (!roundRobin) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  if (roundRobin.createdById !== user.id) return NextResponse.json({ error: "Only the round robin organizer can edit it." }, { status: 403 });
  const existingScoreCount = await prisma.gameScore.count({ where: { match: { roundRobinId } } });
  if (existingScoreCount > 0) return NextResponse.json({ error: "Matches already have scores entered; this round robin can no longer be edited." }, { status: 400 });

  const body = await request.json();
  const partnerFormat = ["ROTATE", "FIXED", "MANUAL"].includes(body.partnerFormat) && (body.partnerFormat !== "MANUAL" || roundRobin.groupId) ? body.partnerFormat : roundRobin.partnerFormat;
  const playFormat = ["SINGLES", "DOUBLES", "MIXED"].includes(body.playFormat) ? body.playFormat : roundRobin.playFormat;
  let scheduledAt = roundRobin.scheduledAt;
  if (typeof body.scheduledAt === "string" && body.scheduledAt) {
    const parsed = new Date(body.scheduledAt);
    if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: "Enter a valid date and time." }, { status: 400 });
    scheduledAt = parsed;
  }
  if (roundRobin.groupId && !scheduledAt) return NextResponse.json({ error: "Pick a date and time so the group knows when to show up." }, { status: 400 });

  const updated = await prisma.roundRobin.update({
    where: { id: roundRobinId },
    data: {
      name: body.name?.trim() || roundRobin.name,
      format: body.format || roundRobin.format,
      partnerFormat,
      playFormat,
      scheduledAt,
      courtCount: Number(body.courtCount) || roundRobin.courtCount,
      roundCount: Number(body.roundCount) || roundRobin.roundCount,
      pointsToWin: [11, 15, 21].includes(Number(body.pointsToWin)) ? Number(body.pointsToWin) : roundRobin.pointsToWin,
      winBy: Number(body.winBy) === 2 ? 2 : 1,
      skillBalanced: typeof body.skillBalanced === "boolean" ? body.skillBalanced : roundRobin.skillBalanced,
    },
  });
  return NextResponse.json({ roundRobin: updated });
}

export async function DELETE(_request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete this round robin." }, { status: 401 });
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId } });
  if (!roundRobin) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  if (roundRobin.createdById !== user.id) return NextResponse.json({ error: "Only the organizer can delete this round robin." }, { status: 403 });
  const scoreCount = await prisma.gameScore.count({ where: { match: { roundRobinId } } });
  if (scoreCount > 0) return NextResponse.json({ error: "Matches already have scores entered; end the round robin instead of deleting it." }, { status: 400 });

  // Match.roundRobinId/roundId are onDelete: SetNull, not Cascade, so matches (and their
  // players) have to be cleaned up explicitly before the round robin itself is removed.
  const matches = await prisma.match.findMany({ where: { roundRobinId }, select: { id: true } });
  const matchIds = matches.map((match) => match.id);
  await prisma.$transaction([
    prisma.matchPlayer.deleteMany({ where: { matchId: { in: matchIds } } }),
    prisma.match.deleteMany({ where: { id: { in: matchIds } } }),
    prisma.roundRobin.delete({ where: { id: roundRobinId } }),
  ]);
  return NextResponse.json({ success: true });
}
