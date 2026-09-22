import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const players = await prisma.user.findMany({ take: 50, select: { id: true, name: true, skillRating: true } });
  const completed = await prisma.match.findMany({ where: { status: "COMPLETED", deletedAt: null }, include: { players: true, scores: true } });
  const entries = players.map((player) => {
    const matches = completed.filter((match) => match.players.some((matchPlayer) => matchPlayer.userId === player.id));
    let wins = 0;
    let scored = 0;
    let conceded = 0;
    matches.forEach((match) => {
      const currentPlayer = match.players.find((matchPlayer) => matchPlayer.userId === player.id);
      const myScore = match.scores.reduce((total, game) => total + (currentPlayer?.side === "A" ? game.sideAScore : game.sideBScore), 0);
      const theirScore = match.scores.reduce((total, game) => total + (currentPlayer?.side === "A" ? game.sideBScore : game.sideAScore), 0);
      scored += myScore;
      conceded += theirScore;
      if (myScore > theirScore) wins += 1;
    });
    const losses = Math.max(0, matches.length - wins);
    const differential = scored - conceded;
    return { name: player.name, rating: player.skillRating.toString(), record: `${wins} - ${losses}`, wins, losses, scored, conceded, differential, winPct: matches.length ? Math.round((wins / matches.length) * 100) : 0, avgPointDiff: matches.length ? Number((differential / matches.length).toFixed(1)) : 0, matches: matches.length, movement: 0 };
  });
  const leaderboard = entries.sort((a, b) => b.wins - a.wins || b.differential - a.differential).map((entry, index) => ({ rank: index + 1, ...entry }));
  return NextResponse.json({ leaderboard });
}
