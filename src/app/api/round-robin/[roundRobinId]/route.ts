import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = await context.params;
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId }, include: { rounds: { orderBy: { roundNumber: "asc" }, include: { matches: { where: { deletedAt: null }, orderBy: { courtNumber: "asc" }, include: { players: { include: { user: { select: { id: true, name: true } } } }, scores: true } } } } } });
  if (!roundRobin) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  return NextResponse.json({ roundRobin: { ...roundRobin, rounds: roundRobin.rounds.map((round) => ({ ...round, matches: round.matches.map((match) => ({ ...match, players: match.players.map((player) => ({ ...player, name: player.user.name })), scores: match.scores.map((score) => ({ ...score })) })) })) } });
}
