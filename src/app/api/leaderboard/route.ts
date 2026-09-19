import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const players = await prisma.user.findMany({ orderBy: { skillRating: "desc" }, take: 50, select: { id: true, name: true, skillRating: true, homeCourt: true } });
  const completed = await prisma.match.findMany({ where: { status: "COMPLETED", deletedAt: null }, include: { players: true, scores: true } });
  const leaderboard = players.map((player, index) => {
    const matches = completed.filter((match) => match.players.some((matchPlayer) => matchPlayer.userId === player.id));
    const wins = matches.filter((match) => { const currentPlayer = match.players.find((matchPlayer) => matchPlayer.userId === player.id); const score = match.scores.reduce((total, game) => total + (currentPlayer?.side === "A" ? game.sideAScore - game.sideBScore : game.sideBScore - game.sideAScore), 0); return score > 0; }).length;
    return { rank: index + 1, name: player.name, rating: player.skillRating.toString(), record: `${wins} - ${Math.max(0, matches.length - wins)}`, matches: matches.length, movement: 0 };
  });
  return NextResponse.json({ leaderboard });
}
