import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// A high win % over a handful of matches isn't statistically meaningful -- require a minimum
// sample size to qualify for ranking, same as batting averages or PGA stats leaders.
const MIN_MATCHES_FOR_RANKING = 20;

export async function GET() {
  const players = await prisma.user.findMany({ take: 50, select: { id: true, name: true, skillRating: true, photoUrl: true } });
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
    return { id: player.id, name: player.name, photoUrl: player.photoUrl, rating: player.skillRating.toString(), record: `${wins} - ${losses}`, wins, losses, scored, conceded, differential, winPct: matches.length ? Math.round((wins / matches.length) * 100) : 0, avgPointDiff: matches.length ? Number((differential / matches.length).toFixed(1)) : 0, matches: matches.length, movement: 0 };
  });
  const leaderboard = entries
    .filter((entry) => entry.matches >= MIN_MATCHES_FOR_RANKING)
    .sort((a, b) => b.winPct - a.winPct || b.differential - a.differential)
    .map((entry, index) => ({ rank: index + 1, ...entry }));
  return NextResponse.json({ leaderboard });
}
