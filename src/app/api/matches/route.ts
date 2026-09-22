import { NextResponse } from "next/server";
import { MatchStatus, Side } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const matches = await prisma.match.findMany({ where: { status: MatchStatus.COMPLETED, deletedAt: null }, orderBy: { scheduledAt: "desc" }, take: 50, include: { scores: true, players: { include: { user: { select: { id: true, name: true } } } }, event: { select: { title: true, location: true } } } });
  const visible = user ? matches.filter((match) => match.players.some((player) => player.userId === user.id)) : matches;
  return NextResponse.json({ matches: visible.map((match) => ({ id: match.id, status: match.status, scheduledAt: match.scheduledAt, event: match.event?.title ?? "Recorded match", location: match.event?.location ?? "Court", scores: match.scores.map((score) => ({ gameNumber: score.gameNumber, sideAScore: score.sideAScore, sideBScore: score.sideBScore })), players: match.players.map((player) => ({ id: player.user.id, name: player.user.name, side: player.side })) })) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to record a match." }, { status: 401 });
  const profile = await ensureProfile(user);
  const body = await request.json();
  const opponentIds = Array.isArray(body.opponentIds) ? body.opponentIds.filter((id: unknown): id is string => typeof id === "string") : [];
  const scores = Array.isArray(body.scores) ? body.scores : [];
  if (!opponentIds.length || !scores.length) return NextResponse.json({ error: "Add at least one opponent and one game score." }, { status: 400 });
  const match = await prisma.match.create({ data: { status: MatchStatus.COMPLETED, scheduledAt: new Date(), enteredById: profile.id, players: { create: [{ userId: profile.id, side: Side.A }, ...opponentIds.map((userId: string) => ({ userId, side: Side.B }))] }, scores: { create: scores.map((score: { sideAScore: number; sideBScore: number }, index: number) => ({ gameNumber: index + 1, sideAScore: Number(score.sideAScore), sideBScore: Number(score.sideBScore), enteredById: profile.id })) } } });
  return NextResponse.json({ matchId: match.id }, { status: 201 });
}
