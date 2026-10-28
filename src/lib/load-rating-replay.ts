import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { replayRatings, type RatedMatch } from "@/lib/rating";

/**
 * Every rated match, oldest first, plus each player's starting rating -- the inputs to
 * replayRatings. Friendly "Record a match" entries (no round robin, event, tournament, league, or
 * ladder challenge) are never rated. Order is when the match was first rated (its earliest skill-rating history row),
 * falling back to when it was last updated for matches never rated. A player's starting rating is
 * the rating they had before their first rated match; players with none start from their current.
 */
export async function loadRatingReplayInputs() {
  const challengeMatchIds = (await prisma.challenge.findMany({ where: { matchId: { not: null } }, select: { matchId: true } })).map((challenge) => challenge.matchId!);
  const [matches, history, users] = await Promise.all([
    prisma.match.findMany({
      where: {
        status: MatchStatus.COMPLETED, deletedAt: null, scores: { some: {} },
        OR: [{ roundRobinId: { not: null } }, { eventId: { not: null } }, { tournamentGroupId: { not: null } }, { leagueDivisionId: { not: null } }, { bracketMatch: { isNot: null } }, { leagueMatch: { isNot: null } }, { id: { in: challengeMatchIds } }],
      },
      select: { id: true, updatedAt: true, players: { select: { userId: true, side: true } }, scores: { select: { sideAScore: true, sideBScore: true } } },
    }),
    prisma.ratingHistory.findMany({ where: { ladderId: null }, orderBy: { createdAt: "asc" }, select: { matchId: true, userId: true, ratingBefore: true, createdAt: true } }),
    prisma.user.findMany({ select: { id: true, skillRating: true } }),
  ]);

  const firstRatedAt = new Map<string, Date>();
  const startingRatings = new Map(users.map((user) => [user.id, Number(user.skillRating)]));
  const seen = new Set<string>();
  for (const row of history) {
    if (row.matchId && !firstRatedAt.has(row.matchId)) firstRatedAt.set(row.matchId, row.createdAt);
    if (!seen.has(row.userId)) { seen.add(row.userId); startingRatings.set(row.userId, Number(row.ratingBefore)); }
  }
  const at = (match: (typeof matches)[number]) => (firstRatedAt.get(match.id) ?? match.updatedAt).getTime();
  const ordered: RatedMatch[] = [...matches].sort((a, b) => at(a) - at(b)).map(({ id, players, scores }) => ({ id, players, scores }));
  return { matches: ordered, startingRatings };
}

/** Ratings and per-match changes for all of history under the current model. */
export async function computeAllRatings() {
  const { matches, startingRatings } = await loadRatingReplayInputs();
  return { ...replayRatings(matches, startingRatings), startingRatings, matchCount: matches.length };
}
