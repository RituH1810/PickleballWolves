import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const players = await prisma.user.findMany({ orderBy: { skillRating: "desc" }, take: 50, select: { id: true, name: true, skillRating: true, homeCourt: true } });
  const completed = await prisma.match.findMany({ where: { status: "COMPLETED", deletedAt: null }, include: { players: true, scores: true } });
  const leaderboard = players.map((player, index) => {
    const matches = completed.filter((match) => match.players.some((matchPlayer) => matchPlayer.userId === player.id));
    let wins = 0;
    let totalDiff = 0;
    matches.forEach((match) => {
      const currentPlayer = match.players.find((matchPlayer) => matchPlayer.userId === player.id);
      const diff = match.scores.reduce((total, game) => total + (currentPlayer?.side === "A" ? game.sideAScore - game.sideBScore : game.sideBScore - game.sideAScore), 0);
      if (diff > 0) wins += 1;
      totalDiff += diff;
    });
    const losses = Math.max(0, matches.length - wins);
    return { rank: index + 1, name: player.name, rating: player.skillRating.toString(), record: `${wins} - ${losses}`, wins, losses, winPct: matches.length ? Math.round((wins / matches.length) * 100) : 0, avgPointDiff: matches.length ? Number((totalDiff / matches.length).toFixed(1)) : 0, matches: matches.length, movement: 0 };
  });
  return NextResponse.json({ leaderboard });
}
