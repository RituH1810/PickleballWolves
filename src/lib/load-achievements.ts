import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeAchievements } from "@/lib/achievements";
import { loadRoundRobinWins } from "@/lib/load-recap";

export async function loadAchievements(userId: string) {
  const matches = await prisma.match.findMany({
    where: { status: MatchStatus.COMPLETED, deletedAt: null, players: { some: { userId } } },
    select: { id: true, updatedAt: true, roundRobinId: true, winnerSide: true, players: { select: { userId: true, side: true } }, scores: { select: { gameNumber: true, sideAScore: true, sideBScore: true } } },
  });
  const matchIds = matches.map((match) => match.id);

  const [matchRatings, ownHistory, topPositions, finals, roundRobinWins] = await Promise.all([
    prisma.ratingHistory.findMany({ where: { matchId: { in: matchIds } }, select: { matchId: true, userId: true, ratingBefore: true } }),
    prisma.ratingHistory.findMany({ where: { userId, ladderId: null }, select: { ratingBefore: true, ratingAfter: true, createdAt: true } }),
    prisma.ladderPosition.findMany({ where: { userId, position: 1 }, select: { ladderId: true, updatedAt: true } }),
    // The final is the only bracket match with nowhere to advance to.
    prisma.tournamentBracketMatch.findMany({
      where: { nextMatchId: null, match: { status: MatchStatus.COMPLETED, deletedAt: null, players: { some: { userId } } } },
      select: { match: { select: { updatedAt: true, winnerSide: true, players: { where: { userId }, select: { side: true } } } } },
    }),
    loadRoundRobinWins(userId),
  ]);

  // Sitting alone on a ladder isn't much of a crown -- require at least one other player.
  let ladderTopAt: Date | null = null;
  for (const position of topPositions) {
    const size = await prisma.ladderPosition.count({ where: { ladderId: position.ladderId } });
    if (size >= 2 && (!ladderTopAt || position.updatedAt < ladderTopAt)) ladderTopAt = position.updatedAt;
  }

  const championAt = finals
    .map((final) => final.match)
    .filter((match) => match && match.winnerSide && match.players[0]?.side === match.winnerSide)
    .map((match) => match!.updatedAt)
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  const ratingBefore = new Map<string, number>();
  for (const row of matchRatings) if (row.matchId) ratingBefore.set(`${row.matchId}:${row.userId}`, Number(row.ratingBefore));

  return computeAchievements({
    userId,
    // updatedAt is when the score was saved, the same ordering the match history uses.
    matches: matches.map((match) => ({ id: match.id, playedAt: match.updatedAt, roundRobinId: match.roundRobinId, winnerSide: match.winnerSide, players: match.players, scores: match.scores })),
    ratingBefore,
    ratingHistory: ownHistory.map((entry) => ({ ratingBefore: Number(entry.ratingBefore), ratingAfter: Number(entry.ratingAfter), createdAt: entry.createdAt })),
    ladderTopAt,
    championAt,
    roundRobinWins,
  });
}
