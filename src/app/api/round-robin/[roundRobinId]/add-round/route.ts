import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
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
  // round robins any active group member.
  let canManage = roundRobin.createdById === user.id;
  if (!canManage && roundRobin.groupId) {
    const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId: roundRobin.groupId, userId: user.id } } });
    canManage = membership?.status === MembershipStatus.ACTIVE;
  }
  if (!canManage) return NextResponse.json({ error: "Only the organizer or a group member can add a round." }, { status: 403 });

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
    // Balance the new round the same way generation does: whoever has played the fewest
    // matches so far across the whole event gets priority for a court this round.
    const matchesPlayed = new Map<string, number>();
    for (const round of existingRounds) {
      for (const match of round.matches) {
        for (const player of match.players) matchesPlayed.set(player.userId, (matchesPlayed.get(player.userId) ?? 0) + 1);
      }
    }
    const playerIds = [...matchesPlayed.keys()];
    const matchesPerRound = Math.min(Math.floor(playerIds.length / 4), roundRobin.courtCount);
    const playersPerRound = matchesPerRound * 4;
    if (matchesPerRound > 0) {
      const playing = shuffle(playerIds).sort((a, b) => matchesPlayed.get(a)! - matchesPlayed.get(b)!).slice(0, playersPerRound);
      const teams = Array.from({ length: matchesPerRound * 2 }, (_, i) => [playing[i * 2], playing[i * 2 + 1]]);
      for (let index = 0; index < matchesPerRound; index++) {
        const teamA = teams[index * 2];
        const teamB = teams[index * 2 + 1];
        matches.push({ roundRobinId, courtNumber: index + 1, scheduledAt, players: { create: [...teamA.map((userId) => ({ userId, side: "A" as const })), ...teamB.map((userId) => ({ userId, side: "B" as const }))] } });
      }
    }
  }

  if (matches.length === 0) return NextResponse.json({ error: "Not enough players to add another round." }, { status: 400 });

  await prisma.$transaction([
    prisma.round.create({ data: { roundRobinId, roundNumber: newRoundNumber, matches: { create: matches } } }),
    prisma.roundRobin.update({ where: { id: roundRobinId }, data: { roundCount: newRoundNumber, status: "LIVE" } }),
  ]);

  return NextResponse.json({ roundNumber: newRoundNumber, matches: matches.length });
}
