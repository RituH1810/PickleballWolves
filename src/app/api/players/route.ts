import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const players = await prisma.user.findMany({ orderBy: { name: "asc" }, take: 100, select: { id: true, name: true, skillRating: true, preferredHand: true } });
  return NextResponse.json({ players: players.map((player) => ({ ...player, skillRating: player.skillRating.toString() })) });
}
