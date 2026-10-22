import { NextResponse } from "next/server";
import { MatchStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { buildLeaderboard, MIN_MATCHES_FOR_RANKING } from "@/lib/leaderboard";

// Public view of a player: only what other members already see on leaderboards, group pages, and
// match history. Email and phone stay private. Signed-out visitors also don't get the home court,
// and only see public groups.
export async function GET(_request: Request, context: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const player = await prisma.user.findUnique({ where: { id: playerId }, select: { id: true, name: true, photoUrl: true, homeCourt: true, preferredHand: true, skillRating: true, createdAt: true, isGuest: true } });
  if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });

  const [matches, leaderboard, groups] = await Promise.all([
    prisma.match.findMany({
      where: { status: MatchStatus.COMPLETED, deletedAt: null, players: { some: { userId: playerId } } },
      orderBy: { updatedAt: "desc" },
      include: { scores: { orderBy: { gameNumber: "asc" } }, players: { include: { user: { select: { id: true, name: true } } } }, event: { select: { title: true } }, roundRobin: { select: { name: true } } },
    }),
    buildLeaderboard(),
    // Only groups the viewer could see anyway: public ones, or ones they're also in.
    prisma.group.findMany({
      where: { memberships: { some: { userId: playerId, status: "ACTIVE" } }, OR: [{ visibility: "PUBLIC" }, ...(user ? [{ memberships: { some: { userId: user.id, status: "ACTIVE" as const } } }] : [])] },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Same win rule as the leaderboard: total points across games decide it.
  const results = matches.map((match) => {
    const mine = match.players.find((entry) => entry.userId === playerId)!;
    const myScore = match.scores.reduce((total, score) => total + (mine.side === "A" ? score.sideAScore : score.sideBScore), 0);
    const theirScore = match.scores.reduce((total, score) => total + (mine.side === "A" ? score.sideBScore : score.sideAScore), 0);
    return { match, mine, won: myScore > theirScore, myScore, theirScore };
  });
  const wins = results.filter((result) => result.won).length;

  // Head-to-head with the viewer, from the viewer's side: matches against each other and together.
  const headToHead = { against: { wins: 0, losses: 0 }, together: { wins: 0, losses: 0 } };
  if (user && user.id !== playerId) {
    for (const { match, mine, won } of results) {
      const viewer = match.players.find((entry) => entry.userId === user.id);
      if (!viewer) continue;
      if (viewer.side === mine.side) headToHead.together[won ? "wins" : "losses"] += 1;
      else headToHead.against[won ? "losses" : "wins"] += 1;
    }
  }

  const entry = leaderboard.find((row) => row.id === playerId);
  const nameFor = (matchPlayer: { user: { id: string; name: string } }) => ({ id: matchPlayer.user.id, name: matchPlayer.user.id === user?.id ? "You" : matchPlayer.user.name });
  return NextResponse.json({
    player: {
      id: player.id,
      name: player.name,
      photoUrl: player.photoUrl,
      homeCourt: user ? player.homeCourt : null,
      preferredHand: player.preferredHand,
      skillRating: player.skillRating.toString(),
      memberSince: player.createdAt,
      matches: matches.length,
      record: `${wins} - ${matches.length - wins}`,
      winRate: matches.length ? `${((wins / matches.length) * 100).toFixed(1)}%` : "0.0%",
      rank: entry?.rank ?? null,
      matchesToQualify: entry ? 0 : Math.max(0, MIN_MATCHES_FOR_RANKING - matches.length),
      isMe: user?.id === playerId,
      isGuest: player.isGuest,
    },
    groups,
    headToHead,
    recent: results.slice(0, 5).map(({ match, mine, won }) => ({
      id: match.id,
      event: match.event?.title ?? match.roundRobin?.name ?? "Recorded match",
      playedAt: match.updatedAt,
      result: match.scores.length ? (won ? "W" : "L") : "-",
      partners: match.players.filter((entry) => entry.side === mine.side && entry.userId !== playerId).map(nameFor),
      opponents: match.players.filter((entry) => entry.side !== mine.side).map(nameFor),
      score: match.scores.map((score) => `${mine.side === "A" ? score.sideAScore : score.sideBScore}-${mine.side === "A" ? score.sideBScore : score.sideAScore}`).join(", "),
    })),
  });
}
