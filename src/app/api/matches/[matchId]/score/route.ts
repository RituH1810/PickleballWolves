import { NextResponse } from "next/server";
import { MatchStatus, Side } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to enter scores." }, { status: 401 });
  const { matchId } = await context.params;
  const body = await request.json();
  const sideAScore = Number(body.sideAScore);
  const sideBScore = Number(body.sideBScore);
  if (!Number.isInteger(sideAScore) || !Number.isInteger(sideBScore) || sideAScore < 0 || sideBScore < 0 || sideAScore === sideBScore) return NextResponse.json({ error: "Enter two different non-negative scores." }, { status: 400 });
  const winnerSide = sideAScore > sideBScore ? Side.A : Side.B;
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { players: true, roundRobin: { select: { createdById: true } } } });
  if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (match.roundRobin && match.roundRobin.createdById !== user.id) return NextResponse.json({ error: "Only the round robin organizer can update scores." }, { status: 403 });
  const score = await prisma.gameScore.upsert({ where: { matchId_gameNumber: { matchId, gameNumber: Number(body.gameNumber) || 1 } }, update: { sideAScore, sideBScore, enteredById: user.id }, create: { matchId, gameNumber: Number(body.gameNumber) || 1, sideAScore, sideBScore, enteredById: user.id } });
  await prisma.match.update({ where: { id: matchId }, data: { status: MatchStatus.COMPLETED, winnerSide } });
  await prisma.auditLog.create({ data: { actorId: user.id, entityType: "GameScore", entityId: score.id, action: "SCORE_ENTERED", afterData: { matchId, gameNumber: score.gameNumber, sideAScore, sideBScore }, matchId } });
  const playerIds = match.players.map((player) => player.userId);
  const players = await prisma.user.findMany({ where: { id: { in: playerIds } }, select: { id: true, skillRating: true } });
  const ratingById = new Map(players.map((player) => [player.id, Number(player.skillRating)]));
  const sideAIds = match.players.filter((player) => player.side === Side.A).map((player) => player.userId).filter((id) => ratingById.has(id));
  const sideBIds = match.players.filter((player) => player.side === Side.B).map((player) => player.userId).filter((id) => ratingById.has(id));
  const MIN_RATING = 2;
  const MAX_RATING = 6;
  if (sideAIds.length && sideBIds.length) {
    const avg = (ids: string[]) => ids.reduce((total, id) => total + ratingById.get(id)!, 0) / ids.length;
    const avgA = avg(sideAIds);
    const avgB = avg(sideBIds);
    const expectedA = 1 / (1 + 10 ** ((avgB - avgA) / 400));
    const actualA = winnerSide === Side.A ? 1 : 0;
    const delta = Math.round(32 * (actualA - expectedA) * 100) / 100;
    const updates = [
      ...sideAIds.map((id) => {
        const before = ratingById.get(id)!;
        const after = Math.min(MAX_RATING, Math.max(MIN_RATING, before + delta));
        return { id, before, after };
      }),
      ...sideBIds.map((id) => {
        const before = ratingById.get(id)!;
        const after = Math.min(MAX_RATING, Math.max(MIN_RATING, before - delta));
        return { id, before, after };
      }),
    ];
    await prisma.$transaction(updates.flatMap(({ id, before, after }) => [
      prisma.user.update({ where: { id }, data: { skillRating: after } }),
      prisma.ratingHistory.create({ data: { userId: id, matchId, ratingBefore: before, ratingAfter: after, ratingDelta: after - before } }),
    ]));
  }
  return NextResponse.json({ score, winnerSide });
}
