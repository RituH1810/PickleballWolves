import { prisma } from "@/lib/prisma";
import { loadRatingReplayInputs } from "@/lib/load-rating-replay";
import { replayRatings, type RatingChange } from "@/lib/rating";

/**
 * Recomputes every skill rating from the full match history and saves it: rewrites the skill
 * rating history (ladder ratings are separate and untouched) and each player's current rating.
 * Run after a score is saved or corrected, or a match is deleted, so ratings never keep the effect
 * of a wrong score. Each match keeps the time it was first rated, so the replay order is stable.
 */
export async function recomputeAllRatings(): Promise<RatingChange[]> {
  const [{ matches, startingRatings }, history] = await Promise.all([
    loadRatingReplayInputs(),
    prisma.ratingHistory.findMany({ where: { ladderId: null, matchId: { not: null } }, select: { matchId: true, createdAt: true } }),
  ]);
  const ratedAt = new Map<string, Date>();
  for (const row of history) {
    const current = ratedAt.get(row.matchId!);
    if (!current || row.createdAt < current) ratedAt.set(row.matchId!, row.createdAt);
  }

  const { ratings, changes } = replayRatings(matches, startingRatings);
  const now = new Date();
  await prisma.$transaction([
    prisma.ratingHistory.deleteMany({ where: { ladderId: null } }),
    prisma.ratingHistory.createMany({ data: changes.map((change) => ({ ...change, createdAt: ratedAt.get(change.matchId) ?? now })) }),
    ...[...ratings].map(([id, rating]) => prisma.user.update({ where: { id }, data: { skillRating: rating } })),
  ]);
  return changes;
}
