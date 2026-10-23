// The skill-rating model, shared by rating updates and match predictions so the two always agree.
export const MIN_RATING = 2;
export const MAX_RATING = 6;
// Rating scale only spans 4 points (2.0-6.0), not the ~thousands chess Elo assumes -- using
// chess's 400-point divisor made the rating gap between any two players on this scale
// negligible, so the expected result was always ~0.5 regardless of actual skill gap, and the 32
// K-factor produced swings several times larger than the whole scale, clamping ratings to
// 2.0 or 6.0 after a single match. Scale both to the actual rating span instead.
export const RATING_SPAN = MAX_RATING - MIN_RATING;
export const K_FACTOR = 0.5;

// An underdog winning with at most this chance counts as an upset.
export const UPSET_MAX_CHANCE = 40;
// Closer than this to 50/50 is a toss-up, with no favorite.
const TOSS_UP_WITHIN = 2;

/** Side A's chance of beating side B (0-1), from their average ratings. */
export function expectedWin(averageA: number, averageB: number) {
  return 1 / (1 + 10 ** ((averageB - averageA) / RATING_SPAN));
}

export type Prediction = { chanceA: number; favorite: "A" | "B" | null };

/** Win chances (as whole percentages) for two sides' ratings, or null if a side has none. */
export function predictMatch(sideA: number[], sideB: number[]): Prediction | null {
  if (!sideA.length || !sideB.length) return null;
  const average = (ratings: number[]) => ratings.reduce((total, rating) => total + rating, 0) / ratings.length;
  const chanceA = Math.round(expectedWin(average(sideA), average(sideB)) * 100);
  return { chanceA, favorite: Math.abs(chanceA - 50) <= TOSS_UP_WITHIN ? null : chanceA > 50 ? "A" : "B" };
}

/** True if the side that won had a small chance going in. */
export function isUpset(prediction: Prediction | null, winnerSide: "A" | "B" | null) {
  if (!prediction || !winnerSide) return false;
  return (winnerSide === "A" ? prediction.chanceA : 100 - prediction.chanceA) <= UPSET_MAX_CHANCE;
}
