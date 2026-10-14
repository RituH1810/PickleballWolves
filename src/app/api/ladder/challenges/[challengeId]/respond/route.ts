import { NextResponse } from "next/server";
import { Side } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";
import { notify } from "@/lib/notifications";

export async function POST(request: Request, context: { params: Promise<{ challengeId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to respond to this challenge." }, { status: 401 });
  const profile = await ensureProfile(user);
  const { challengeId } = await context.params;
  const body = await request.json();
  if (!["ACCEPTED", "DECLINED"].includes(body.status)) return NextResponse.json({ error: "Invalid response." }, { status: 400 });

  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
  if (challenge.challengedId !== profile.id) return NextResponse.json({ error: "Only the challenged player can respond." }, { status: 403 });
  if (challenge.status !== "PENDING") return NextResponse.json({ error: "This challenge has already been responded to." }, { status: 400 });
  if (challenge.deadlineAt < new Date()) {
    await prisma.challenge.update({ where: { id: challengeId }, data: { status: "EXPIRED" } });
    return NextResponse.json({ error: "This challenge has expired." }, { status: 400 });
  }

  if (body.status === "DECLINED") {
    await prisma.challenge.update({ where: { id: challengeId }, data: { status: "DECLINED" } });
    await notify(challenge.challengerId, "challenge", "CHALLENGE_DECLINED", `${profile.name} declined your challenge`, "Try challenging someone else on the ladder.");
    return NextResponse.json({ status: "DECLINED" });
  }

  // Challenger stays side A, challenged stays side B -- the score route's ladder-climb logic
  // (and the challenge's own matchId linkage) relies on that fixed mapping.
  const match = await prisma.match.create({ data: { status: "SCHEDULED", players: { create: [{ userId: challenge.challengerId, side: Side.A }, { userId: challenge.challengedId, side: Side.B }] } } });
  await prisma.challenge.update({ where: { id: challengeId }, data: { status: "ACCEPTED", matchId: match.id } });
  await notify(challenge.challengerId, "challenge", "CHALLENGE_ACCEPTED", `${profile.name} accepted your challenge`, "Play your match, then report the score from the ladder page.");
  return NextResponse.json({ status: "ACCEPTED", matchId: match.id });
}
