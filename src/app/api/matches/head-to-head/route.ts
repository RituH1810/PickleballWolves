import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ opponents: [] });

  const matches = await prisma.match.findMany({
    where: { status: "COMPLETED", deletedAt: null, players: { some: { userId: user.id } } },
    include: { players: { include: { user: { select: { id: true, name: true } } } }, scores: true },
  });

  // In doubles, a single match has two opponents (both players on the other side) -- count the
  // result against each of them individually, regardless of who either side's partner was.
  const stats = new Map<string, { id: string; name: string; matches: number; wins: number; losses: number; scored: number; conceded: number }>();
  for (const match of matches) {
    const mine = match.players.find((player) => player.userId === user.id);
    if (!mine) continue;
    const myScore = match.scores.reduce((total, score) => total + (mine.side === "A" ? score.sideAScore : score.sideBScore), 0);
    const theirScore = match.scores.reduce((total, score) => total + (mine.side === "A" ? score.sideBScore : score.sideAScore), 0);
    const won = myScore > theirScore;
    for (const opponent of match.players.filter((player) => player.side !== mine.side)) {
      if (!stats.has(opponent.userId)) stats.set(opponent.userId, { id: opponent.userId, name: opponent.user.name, matches: 0, wins: 0, losses: 0, scored: 0, conceded: 0 });
      const entry = stats.get(opponent.userId)!;
      entry.matches += 1;
      if (won) entry.wins += 1; else entry.losses += 1;
      entry.scored += myScore;
      entry.conceded += theirScore;
    }
  }

  const opponents = [...stats.values()]
    .map((entry) => ({ ...entry, winPct: entry.matches ? Math.round((entry.wins / entry.matches) * 100) : 0, differential: entry.scored - entry.conceded }))
    .sort((a, b) => b.matches - a.matches || b.winPct - a.winPct);

  return NextResponse.json({ opponents });
}
