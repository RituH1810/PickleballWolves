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

type MatchInput = { roundRobinId: string; courtNumber: number; scheduledAt: Date; players: { create: { userId: string; side: "A" | "B" }[] } };

export async function POST(request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to add a round." }, { status: 401 });
  const { roundRobinId } = await context.params;
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId } });
  if (!roundRobin) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });

  // Same permission model as generating the initial schedule: organizer always, or for group
  // round robins any member who has actually joined.
  let canManage = roundRobin.createdById === user.id;
  if (!canManage && roundRobin.groupId) {
    const myRsvp = await prisma.roundRobinRSVP.findUnique({ where: { roundRobinId_userId: { roundRobinId, userId: user.id } } });
    canManage = myRsvp?.status === "JOINED";
  }
  if (!canManage) return NextResponse.json({ error: "Only the organizer or a joined member can add a round." }, { status: 403 });

  const existingRounds = await prisma.round.findMany({
    where: { roundRobinId },
    include: { matches: { where: { deletedAt: null }, include: { players: true } } },
  });
  if (existingRounds.length === 0) return NextResponse.json({ error: "Generate the initial schedule before adding more rounds." }, { status: 400 });

  const isDoubles = roundRobin.playFormat !== "SINGLES";
  const fixedPartners = roundRobin.partnerFormat === "FIXED";
  const newRoundNumber = Math.max(...existingRounds.map((round) => round.roundNumber)) + 1;
  const scheduledAt = roundRobin.scheduledAt ?? new Date();
  const matches: MatchInput[] = [];

  if (!isDoubles || fixedPartners) {
    // Stable units (individual players for singles, fixed pairs for teams) never change once
    // formed, so any match they've appeared in reveals the unit -- reconstruct the full roster
    // from history, then deal a fresh randomized round among them.
    const units = new Map<string, string[]>();
    for (const round of existingRounds) {
      for (const match of round.matches) {
        for (const side of ["A", "B"] as const) {
          const unit = match.players.filter((player) => player.side === side).map((player) => player.userId).sort();
          if (unit.length > 0) units.set(unit.join(","), unit);
        }
      }
    }
    const shuffled = shuffle([...units.values()]);
    if (shuffled.length % 2) shuffled.push(["BYE"]);
    for (let index = 0; index < shuffled.length / 2; index++) {
      const teamA = shuffled[index];
      const teamB = shuffled[shuffled.length - 1 - index];
      if (teamA.includes("BYE") || teamB.includes("BYE")) continue;
      matches.push({ roundRobinId, courtNumber: (index % roundRobin.courtCount) + 1, scheduledAt, players: { create: [...teamA.map((userId) => ({ userId, side: "A" as const })), ...teamB.map((userId) => ({ userId, side: "B" as const }))] } });
    }
  } else {
    const playerIds = [...new Set(existingRounds.flatMap((round) => round.matches.flatMap((match) => match.players.map((player) => player.userId))))];
    const shuffled = shuffle(playerIds);
    if (shuffled.length % 2) shuffled.pop();
    const teams = Array.from({ length: Math.floor(shuffled.length / 2) }, (_, i) => [shuffled[i * 2], shuffled[i * 2 + 1]]);
    for (let index = 0; index < Math.floor(teams.length / 2); index++) {
      const teamA = teams[index * 2];
      const teamB = teams[index * 2 + 1];
      matches.push({ roundRobinId, courtNumber: (index % roundRobin.courtCount) + 1, scheduledAt, players: { create: [...teamA.map((userId) => ({ userId, side: "A" as const })), ...teamB.map((userId) => ({ userId, side: "B" as const }))] } });
    }
  }

  if (matches.length === 0) return NextResponse.json({ error: "Not enough players to add another round." }, { status: 400 });

  await prisma.$transaction([
    prisma.round.create({ data: { roundRobinId, roundNumber: newRoundNumber, matches: { create: matches } } }),
    prisma.roundRobin.update({ where: { id: roundRobinId }, data: { roundCount: newRoundNumber, status: "LIVE" } }),
  ]);

  return NextResponse.json({ roundNumber: newRoundNumber, matches: matches.length });
}
