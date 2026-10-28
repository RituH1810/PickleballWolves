// DUPR-style skill ratings. Everyone starts at 2.000 and earns their rating purely from match
// results: the score margin matters (not just win/loss), each player moves by their own amount (a
// player's first matches move a lot so they can climb to their level, then changes are small), and
// ratings run 2.0-8.0. Because ratings depend on the order matches were played, they're
// computed by replaying every scored match oldest-first -- so editing or correcting a score, or
// deleting a match, simply re-runs history and every rating stays consistent.

export const RATING_MIN = 2;
export const RATING_MAX = 8;
/** Every player -- member or guest -- starts here; no self-chosen ratings. */
export const START_RATING = RATING_MIN;
// How much a rating gap shifts the expected share of points: a team 1.0 better is expected to win
// about 64% of the points (roughly 11-6), 2.0 better about 76%.
export const POINTS_DIVISOR = 4;
// Per-match sensitivity: a player's first matches move a lot (calibration, so everyone can climb
// from 2.000 to their real level), then DUPR-sized -- a few thousandths per match (0.002-0.02).
export const K_ESTABLISHED = 0.05;
export const K_NEW_BONUS = 1.45;
export const K_SETTLE_MATCHES = 15;

export type RatedMatch = {
  id: string;
  players: { userId: string; side: "A" | "B" }[];
  scores: { sideAScore: number; sideBScore: number }[];
};

export type RatingChange = { matchId: string; userId: string; ratingBefore: number; ratingAfter: number; ratingDelta: number };

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const clamp = (value: number) => Math.min(RATING_MAX, Math.max(RATING_MIN, value));

/** The share of points side A is expected to win, from the two sides' average ratings. */
export function expectedPointShare(averageA: number, averageB: number) {
  return 1 / (1 + 10 ** ((averageB - averageA) / POINTS_DIVISOR));
}

/** How far one match moves a player who has played `matchesPlayed` rated matches so far. */
export function kFactor(matchesPlayed: number) {
  return K_ESTABLISHED + K_NEW_BONUS * Math.exp(-matchesPlayed / K_SETTLE_MATCHES);
}

/**
 * Replays matches in the order given (oldest first) from each player's starting rating. Returns
 * every player's final rating and one change per player per rated match. Matches without points,
 * or where a side has nobody, are skipped.
 */
export function replayRatings(matches: RatedMatch[], startingRatings = new Map<string, number>(), defaultRating = START_RATING, k: (matchesPlayed: number) => number = kFactor) {
  const ratings = new Map<string, number>();
  const played = new Map<string, number>();
  const ratingOf = (userId: string) => ratings.get(userId) ?? startingRatings.get(userId) ?? defaultRating;
  const changes: RatingChange[] = [];

  for (const match of matches) {
    const pointsA = match.scores.reduce((total, score) => total + score.sideAScore, 0);
    const pointsB = match.scores.reduce((total, score) => total + score.sideBScore, 0);
    const sideA = match.players.filter((player) => player.side === "A");
    const sideB = match.players.filter((player) => player.side === "B");
    if (pointsA + pointsB === 0 || !sideA.length || !sideB.length) continue;

    const average = (side: typeof sideA) => side.reduce((total, player) => total + ratingOf(player.userId), 0) / side.length;
    const surprise = pointsA / (pointsA + pointsB) - expectedPointShare(average(sideA), average(sideB));
    const before = new Map(match.players.map((player) => [player.userId, ratingOf(player.userId)]));
    for (const player of match.players) {
      const ratingBefore = before.get(player.userId)!;
      const step = k(played.get(player.userId) ?? 0) * (player.side === "A" ? surprise : -surprise);
      const ratingAfter = round3(clamp(ratingBefore + step));
      ratings.set(player.userId, ratingAfter);
      played.set(player.userId, (played.get(player.userId) ?? 0) + 1);
      changes.push({ matchId: match.id, userId: player.userId, ratingBefore: round3(ratingBefore), ratingAfter, ratingDelta: round3(ratingAfter - ratingBefore) });
    }
  }
  return { ratings, changes };
}
