import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadMatchDetails } from "@/lib/load-match-details";
import { computeWinStreaks } from "@/lib/win-streak";

/**
 * A player's best and current win streaks. With a viewerId, also the matches in the best streak
 * (date, partner, opponents, score and where it was played), oldest first.
 */
export async function loadWinStreak(userId: string, viewerId: string | null) {
  const matches = await prisma.match.findMany({
    where: { status: MatchStatus.COMPLETED, deletedAt: null, players: { some: { userId } } },
    select: { id: true, updatedAt: true, winnerSide: true, players: { select: { userId: true, side: true } }, scores: { select: { gameNumber: true, sideAScore: true, sideBScore: true } } },
  });
  const streaks = computeWinStreaks(matches.map((match) => ({ ...match, playedAt: match.updatedAt })), userId);
  return {
    best: streaks.best.length,
    current: streaks.current,
    matches: viewerId ? await loadMatchDetails(streaks.best.matchIds, userId, viewerId) : [],
  };
}
