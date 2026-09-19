import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

function shuffle<T>(items: T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

type MatchInput = { courtNumber: number; players: { create: { userId: string; side: "A" | "B" }[] } };
type RoundInput = { roundNumber: number; matches: MatchInput[] };

export async function POST(request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to generate a schedule." }, { status: 401 });
  const { roundRobinId } = await context.params;
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId } });
  if (!roundRobin || roundRobin.createdById !== user.id) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  const body = await request.json();
  const playerIds: string[] = Array.isArray(body.playerIds) ? body.playerIds.filter((id: unknown): id is string => typeof id === "string") : [];
  if (playerIds.length < 4) return NextResponse.json({ error: "Add at least four players." }, { status: 400 });

  const isDoubles = roundRobin.playFormat !== "SINGLES";
  const fixedPartners = roundRobin.partnerFormat === "FIXED";
  const rounds: RoundInput[] = [];

  if (!isDoubles || fixedPartners) {
    // Stable units for the whole event: individual players (singles), or fixed teams (doubles/mixed) rotated with the circle method.
    let units: string[][] = isDoubles
      ? Array.from({ length: Math.floor(playerIds.length / 2) }, (_, i) => [playerIds[i * 2], playerIds[i * 2 + 1]])
      : playerIds.map((id) => [id]);
    if (units.length % 2) units.push(["BYE"]);
    for (let roundNumber = 1; roundNumber <= roundRobin.roundCount; roundNumber++) {
      const matches: MatchInput[] = [];
      for (let index = 0; index < units.length / 2; index++) {
        const teamA = units[index];
        const teamB = units[units.length - 1 - index];
        if (teamA.includes("BYE") || teamB.includes("BYE")) continue;
        matches.push({ courtNumber: (index % roundRobin.courtCount) + 1, players: { create: [...teamA.map((userId) => ({ userId, side: "A" as const })), ...teamB.map((userId) => ({ userId, side: "B" as const }))] } });
      }
      rounds.push({ roundNumber, matches });
      const fixed = units[0];
      const rotating = units.slice(1);
      rotating.unshift(rotating.pop()!);
      units = [fixed, ...rotating];
    }
  } else {
    // Rotating doubles/mixed partners: reshuffle players into fresh teams every round.
    for (let roundNumber = 1; roundNumber <= roundRobin.roundCount; roundNumber++) {
      const shuffled = shuffle(playerIds);
      if (shuffled.length % 2) shuffled.pop();
      const teams: string[][] = Array.from({ length: Math.floor(shuffled.length / 2) }, (_, i) => [shuffled[i * 2], shuffled[i * 2 + 1]]);
      const matches: MatchInput[] = [];
      for (let index = 0; index < Math.floor(teams.length / 2); index++) {
        const teamA = teams[index * 2];
        const teamB = teams[index * 2 + 1];
        matches.push({ courtNumber: (index % roundRobin.courtCount) + 1, players: { create: [...teamA.map((userId) => ({ userId, side: "A" as const })), ...teamB.map((userId) => ({ userId, side: "B" as const }))] } });
      }
      rounds.push({ roundNumber, matches });
    }
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.round.deleteMany({ where: { roundRobinId } });
    for (const round of rounds) await transaction.round.create({ data: { roundRobinId, roundNumber: round.roundNumber, matches: { create: round.matches } } });
    await transaction.roundRobin.update({ where: { id: roundRobinId }, data: { status: "LIVE" } });
  });
  return NextResponse.json({ rounds: rounds.length, matches: rounds.reduce((total, round) => total + round.matches.length, 0) });
}
