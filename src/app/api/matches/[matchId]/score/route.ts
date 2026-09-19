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
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { players: true } });
  if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  const score = await prisma.gameScore.upsert({ where: { matchId_gameNumber: { matchId, gameNumber: Number(body.gameNumber) || 1 } }, update: { sideAScore, sideBScore, enteredById: user.id }, create: { matchId, gameNumber: Number(body.gameNumber) || 1, sideAScore, sideBScore, enteredById: user.id } });
  await prisma.match.update({ where: { id: matchId }, data: { status: MatchStatus.COMPLETED, winnerSide } });
  await prisma.auditLog.create({ data: { actorId: user.id, entityType: "GameScore", entityId: score.id, action: "SCORE_ENTERED", afterData: { matchId, gameNumber: score.gameNumber, sideAScore, sideBScore }, matchId } });
  const playerIds = match.players.map((player) => player.userId);
  const players = await prisma.user.findMany({ where: { id: { in: playerIds } }, select: { id: true, skillRating: true } });
  if (players.length >= 2) {
    const sideA = players.find((player) => match.players.find((matchPlayer) => matchPlayer.userId === player.id)?.side === Side.A);
    const sideB = players.find((player) => match.players.find((matchPlayer) => matchPlayer.userId === player.id)?.side === Side.B);
    if (sideA && sideB) {
      const expectedA = 1 / (1 + 10 ** ((Number(sideB.skillRating) - Number(sideA.skillRating)) / 400));
      const actualA = winnerSide === Side.A ? 1 : 0;
      const delta = Math.round(32 * (actualA - expectedA) * 100) / 100;
      await prisma.$transaction([prisma.user.update({ where: { id: sideA.id }, data: { skillRating: Number(sideA.skillRating) + delta } }), prisma.user.update({ where: { id: sideB.id }, data: { skillRating: Number(sideB.skillRating) - delta } }), prisma.ratingHistory.create({ data: { userId: sideA.id, matchId, ratingBefore: Number(sideA.skillRating), ratingAfter: Number(sideA.skillRating) + delta, ratingDelta: delta } }), prisma.ratingHistory.create({ data: { userId: sideB.id, matchId, ratingBefore: Number(sideB.skillRating), ratingAfter: Number(sideB.skillRating) - delta, ratingDelta: -delta } })]);
    }
  }
  return NextResponse.json({ score, winnerSide });
}
