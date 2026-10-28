import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { replayRatings, type RatedMatch } from "@/lib/rating";

/**
 * Every rated match, oldest first -- the input to replayRatings. Everyone starts at START_RATING,
 * so only the matches matter. Order is when the match was first rated (its earliest skill-rating
 * history row), falling back to when it was last updated for matches never rated. Friendly "Record a
 * match" entries (no round robin, event, tournament, league, or ladder challenge) are never rated.
 */
export async function loadRatingReplayInputs() {
  const challengeMatchIds = (await prisma.challenge.findMany({ where: { matchId: { not: null } }, select: { matchId: true } })).map((challenge) => challenge.matchId!);
  const [matches, history] = await Promise.all([
    prisma.match.findMany({
      where: {
        status: MatchStatus.COMPLETED, deletedAt: null, scores: { some: {} },
        OR: [{ roundRobinId: { not: null } }, { eventId: { not: null } }, { tournamentGroupId: { not: null } }, { leagueDivisionId: { not: null } }, { bracketMatch: { isNot: null } }, { leagueMatch: { isNot: null } }, { id: { in: challengeMatchIds } }],
      },
      select: { id: true, createdAt: true, updatedAt: true, players: { select: { userId: true, side: true } }, scores: { select: { sideAScore: true, sideBScore: true } } },
    }),
    prisma.ratingHistory.findMany({ where: { ladderId: null, matchId: { not: null } }, select: { matchId: true, createdAt: true } }),
  ]);

  const firstRatedAt = new Map<string, Date>();
  for (const row of history) {
    const current = firstRatedAt.get(row.matchId!);
    if (!current || row.createdAt < current) firstRatedAt.set(row.matchId!, row.createdAt);
  }
  const at = (match: (typeof matches)[number]) => (firstRatedAt.get(match.id) ?? match.updatedAt).getTime();
  // Some matches were rated in one batch with identical times; break ties by creation time, then id,
  // so every replay uses the same order (otherwise ratings would drift a little on each recompute).
  const ordered: RatedMatch[] = [...matches]
    .sort((a, b) => at(a) - at(b) || a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(({ id, players, scores }) => ({ id, players, scores }));
  return { matches: ordered, firstRatedAt };
}

/** Ratings and per-match changes for all of history under the current model. */
export async function computeAllRatings() {
  const { matches } = await loadRatingReplayInputs();
  return { ...replayRatings(matches), matchCount: matches.length };
}
