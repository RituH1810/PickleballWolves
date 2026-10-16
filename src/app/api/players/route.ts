import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildLeaderboard } from "@/lib/leaderboard";

export async function GET() {
  const players = await prisma.user.findMany({ orderBy: { name: "asc" }, take: 100, select: { id: true, name: true, preferredHand: true, skillRating: true, gender: true } });
  // Same ranking as the leaderboard: only players with enough matches to qualify get a rank.
  const rankById = new Map((await buildLeaderboard()).map((entry) => [entry.id, entry.rank]));

  return NextResponse.json({ players: players.map((player) => ({ ...player, skillRating: player.skillRating.toString(), rank: rankById.get(player.id) ?? null })) });
}
