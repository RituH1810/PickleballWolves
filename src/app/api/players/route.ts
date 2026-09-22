import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const players = await prisma.user.findMany({ orderBy: { name: "asc" }, take: 100, select: { id: true, name: true, preferredHand: true } });
  const completed = await prisma.match.findMany({ where: { status: "COMPLETED", deletedAt: null }, include: { players: true, scores: true } });

  // Rank must match the community leaderboard's algorithm (win % then point differential), not raw skill rating.
  const standings = players
    .map((player) => {
      const playerMatches = completed.filter((match) => match.players.some((matchPlayer) => matchPlayer.userId === player.id));
      let wins = 0;
      let scored = 0;
      let conceded = 0;
      playerMatches.forEach((match) => {
        const currentPlayer = match.players.find((matchPlayer) => matchPlayer.userId === player.id);
        const myScore = match.scores.reduce((total, score) => total + (currentPlayer?.side === "A" ? score.sideAScore : score.sideBScore), 0);
        const theirScore = match.scores.reduce((total, score) => total + (currentPlayer?.side === "A" ? score.sideBScore : score.sideAScore), 0);
        scored += myScore;
        conceded += theirScore;
        if (myScore > theirScore) wins += 1;
      });
      return { id: player.id, winPct: playerMatches.length ? wins / playerMatches.length : 0, differential: scored - conceded };
    })
    .sort((a, b) => b.winPct - a.winPct || b.differential - a.differential);
  const rankById = new Map(standings.map((entry, index) => [entry.id, index + 1]));

  return NextResponse.json({ players: players.map((player) => ({ ...player, rank: rankById.get(player.id) ?? null })) });
}
