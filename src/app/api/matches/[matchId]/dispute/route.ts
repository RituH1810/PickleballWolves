import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to dispute a score." }, { status: 401 });
  const { matchId } = await context.params;
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { players: true } });
  if (!match || !match.players.some((player) => player.userId === user.id)) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  const body = await request.json();
  if (!body.reason?.trim()) return NextResponse.json({ error: "Add a reason for the dispute." }, { status: 400 });
  const dispute = await prisma.scoreDispute.create({ data: { matchId, openedById: user.id, reason: body.reason.trim(), proposedScores: body.proposedScores ?? undefined } });
  await prisma.auditLog.create({ data: { actorId: user.id, entityType: "Match", entityId: matchId, action: "SCORE_DISPUTED", afterData: { disputeId: dispute.id }, matchId } });
  return NextResponse.json({ dispute }, { status: 201 });
}
