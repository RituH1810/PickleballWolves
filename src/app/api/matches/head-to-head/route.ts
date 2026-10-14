import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

type Stat = { id: string; name: string; matches: number; wins: number; losses: number; scored: number; conceded: number };

function finalize(stats: Map<string, Stat>) {
  return [...stats.values()]
    .map((entry) => ({ ...entry, winPct: entry.matches ? Math.round((entry.wins / entry.matches) * 100) : 0, differential: entry.scored - entry.conceded }))
    .sort((a, b) => b.matches - a.matches || b.winPct - a.winPct);
}

function accumulate(stats: Map<string, Stat>, player: { userId: string; user: { name: string } }, won: boolean, myScore: number, theirScore: number) {
  if (!stats.has(player.userId)) stats.set(player.userId, { id: player.userId, name: player.user.name, matches: 0, wins: 0, losses: 0, scored: 0, conceded: 0 });
  const entry = stats.get(player.userId)!;
  entry.matches += 1;
  if (won) entry.wins += 1; else entry.losses += 1;
  entry.scored += myScore;
  entry.conceded += theirScore;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ opponents: [], partners: [] });

  const matches = await prisma.match.findMany({
    where: { status: "COMPLETED", deletedAt: null, players: { some: { userId: user.id } } },
    include: { players: { include: { user: { select: { id: true, name: true } } } }, scores: true },
  });

  // In doubles, a single match has two opponents (both players on the other side) and up to one
  // teammate (the other player on your own side) -- count the result against/with each of them
  // individually. Opponents/partners-of-partners don't matter here, only who was literally on
  // court with or against you that game.
  const opponentStats = new Map<string, Stat>();
  const partnerStats = new Map<string, Stat>();
  for (const match of matches) {
    const mine = match.players.find((player) => player.userId === user.id);
    if (!mine) continue;
    const myScore = match.scores.reduce((total, score) => total + (mine.side === "A" ? score.sideAScore : score.sideBScore), 0);
    const theirScore = match.scores.reduce((total, score) => total + (mine.side === "A" ? score.sideBScore : score.sideAScore), 0);
    const won = myScore > theirScore;
    for (const opponent of match.players.filter((player) => player.side !== mine.side)) accumulate(opponentStats, opponent, won, myScore, theirScore);
    for (const partner of match.players.filter((player) => player.side === mine.side && player.userId !== user.id)) accumulate(partnerStats, partner, won, myScore, theirScore);
  }

  return NextResponse.json({ opponents: finalize(opponentStats), partners: finalize(partnerStats) });
}
