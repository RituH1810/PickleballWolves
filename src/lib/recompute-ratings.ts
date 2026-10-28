import { prisma } from "@/lib/prisma";
import { loadRatingReplayInputs } from "@/lib/load-rating-replay";
import { replayRatings, START_RATING, type RatingChange } from "@/lib/rating";

/**
 * Recomputes every skill rating from the full match history and saves it: rewrites the skill
 * rating history (ladder ratings are separate and untouched) and each player's current rating.
 * Run after a score is saved or corrected, or a match is deleted, so ratings never keep the effect
 * of a wrong score. Each match keeps the time it was first rated, so the replay order is stable.
 */
export async function recomputeAllRatings(): Promise<RatingChange[]> {
  const { matches, firstRatedAt } = await loadRatingReplayInputs();
  const { ratings, changes } = replayRatings(matches);
  const now = new Date();
  await prisma.$transaction([
    prisma.ratingHistory.deleteMany({ where: { ladderId: null } }),
    prisma.ratingHistory.createMany({ data: changes.map((change) => ({ ...change, createdAt: firstRatedAt.get(change.matchId) ?? now })) }),
    // Everyone without a rated match is back at the start too.
    prisma.user.updateMany({ where: { id: { notIn: [...ratings.keys()] } }, data: { skillRating: START_RATING } }),
    ...[...ratings].map(([id, rating]) => prisma.user.update({ where: { id }, data: { skillRating: rating } })),
  ]);
  return changes;
}
