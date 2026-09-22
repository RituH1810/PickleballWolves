import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId }, include: { rounds: { orderBy: { roundNumber: "asc" }, include: { matches: { where: { deletedAt: null }, orderBy: { courtNumber: "asc" }, include: { players: { include: { user: { select: { id: true, name: true } } } }, scores: true } } } } } });
  if (!roundRobin) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  const organizer = await prisma.user.findUnique({ where: { id: roundRobin.createdById }, select: { name: true } });
  const hasScores = roundRobin.rounds.some((round) => round.matches.some((match) => match.scores.length > 0));
  return NextResponse.json({ roundRobin: { ...roundRobin, organizerName: organizer?.name ?? "Unknown", isOwner: user ? roundRobin.createdById === user.id : false, hasScores, rounds: roundRobin.rounds.map((round) => ({ ...round, matches: round.matches.map((match) => ({ ...match, players: match.players.map((player) => ({ ...player, name: player.user.name })), scores: match.scores.map((score) => ({ ...score })) })) })) } });
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
  const partnerFormat = ["ROTATE", "FIXED"].includes(body.partnerFormat) ? body.partnerFormat : roundRobin.partnerFormat;
  const playFormat = ["SINGLES", "DOUBLES", "MIXED"].includes(body.playFormat) ? body.playFormat : roundRobin.playFormat;
  const updated = await prisma.roundRobin.update({
    where: { id: roundRobinId },
    data: {
      name: body.name?.trim() || roundRobin.name,
      format: body.format || roundRobin.format,
      partnerFormat,
      playFormat,
      courtCount: Number(body.courtCount) || roundRobin.courtCount,
      roundCount: Number(body.roundCount) || roundRobin.roundCount,
      pointsToWin: [11, 15, 21].includes(Number(body.pointsToWin)) ? Number(body.pointsToWin) : roundRobin.pointsToWin,
      winBy: Number(body.winBy) === 2 ? 2 : 1,
      skillBalanced: typeof body.skillBalanced === "boolean" ? body.skillBalanced : roundRobin.skillBalanced,
    },
  });
  return NextResponse.json({ roundRobin: updated });
}
