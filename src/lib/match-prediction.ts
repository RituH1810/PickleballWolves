// Win chances before a match, from players' skill ratings (see rating.ts for how ratings move).
// A 1.0 rating edge makes a side about a 64% favorite to win.
export const RATING_SPAN = 4;

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
