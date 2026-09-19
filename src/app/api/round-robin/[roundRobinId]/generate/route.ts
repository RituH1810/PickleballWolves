import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to generate a schedule." }, { status: 401 });
  const { roundRobinId } = await context.params;
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId } });
  if (!roundRobin || roundRobin.createdById !== user.id) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  const body = await request.json();
  const playerIds = Array.isArray(body.playerIds) ? body.playerIds.filter((id: unknown): id is string => typeof id === "string") : [];
  if (playerIds.length < 4) return NextResponse.json({ error: "Add at least four players." }, { status: 400 });
  const players = [...playerIds];
  if (players.length % 2) players.push("BYE");
  const rounds: { roundNumber: number; matches: { courtNumber: number; players: { create: { userId: string; side: "A" | "B" }[] } }[] }[] = [];
  for (let roundNumber = 1; roundNumber <= roundRobin.roundCount; roundNumber++) {
    const matches = [];
    for (let index = 0; index < players.length / 2; index++) {
      const sideA = players[index];
      const sideB = players[players.length - 1 - index];
      if (sideA === "BYE" || sideB === "BYE") continue;
      matches.push({ courtNumber: (index % roundRobin.courtCount) + 1, players: { create: [{ userId: sideA, side: "A" as const }, { userId: sideB, side: "B" as const }] } });
    }
    rounds.push({ roundNumber, matches });
    const fixed = players[0];
    const rotating = players.slice(1);
    rotating.unshift(rotating.pop()!);
    players.splice(0, players.length, fixed, ...rotating);
  }
  await prisma.$transaction(async (transaction) => {
    await transaction.round.deleteMany({ where: { roundRobinId } });
    for (const round of rounds) await transaction.round.create({ data: { roundRobinId, roundNumber: round.roundNumber, matches: { create: round.matches } } });
    await transaction.roundRobin.update({ where: { id: roundRobinId }, data: { status: "LIVE" } });
  });
  return NextResponse.json({ rounds: rounds.length, matches: rounds.reduce((total, round) => total + round.matches.length, 0) });
}
