import { expectedWin, MAX_RATING, MIN_RATING } from "./match-prediction";

/** How far one even match can move a rating at most, before the margin and new-player boosts. */
export const RATING_K = 0.15;
/** Players with fewer rated matches than this move twice as fast, so a wrong starting rating corrects quickly. */
export const PROVISIONAL_MATCHES = 5;
/** Ratings are kept to three decimals, like DUPR. */
export const RATING_DECIMALS = 3;

export type RatedPlayer = { userId: string; rating: number; ratedMatches: number };
export type RatingChange = { userId: string; side: "A" | "B"; before: number; after: number; delta: number };

const round = (value: number) => Math.round(value * 10 ** RATING_DECIMALS) / 10 ** RATING_DECIMALS;
const average = (players: RatedPlayer[]) => players.reduce((total, player) => total + player.rating, 0) / players.length;

/** The match result from all its games: the side that won more games (then more points), and each side's points. Null if level. */
export function matchResult(scores: { sideAScore: number; sideBScore: number }[]) {
  let gamesA = 0, gamesB = 0, pointsA = 0, pointsB = 0;
  for (const score of scores) {
    pointsA += score.sideAScore;
    pointsB += score.sideBScore;
    if (score.sideAScore > score.sideBScore) gamesA += 1; else if (score.sideBScore > score.sideAScore) gamesB += 1;
  }
  const winner = gamesA !== gamesB ? (gamesA > gamesB ? "A" : "B") : pointsA !== pointsB ? (pointsA > pointsB ? "A" : "B") : null;
  return winner ? { winner: winner as "A" | "B", pointsA, pointsB } : null;
}

/**
 * Each player's rating change for one match. Like DUPR, partners move separately:
 * - Expectation is per player, from their own rating blended with their team's average against
 *   the opponents' average, so the stronger partner is expected to do more and gains less for a win.
 * - The margin scales the change: an 11-10 win moves ratings about half as much as an 11-0.
 * - Players still on their first PROVISIONAL_MATCHES rated matches move twice as fast.
 * A win never lowers a rating and a loss never raises one. Ratings stay within 2.0-6.0.
 */
export function rateMatch(sideA: RatedPlayer[], sideB: RatedPlayer[], result: { winner: "A" | "B"; pointsA: number; pointsB: number }): RatingChange[] {
  if (!sideA.length || !sideB.length) return [];
  const winnerPoints = Math.max(result.pointsA, result.pointsB);
  const marginShare = winnerPoints ? Math.abs(result.pointsA - result.pointsB) / winnerPoints : 0;
  const marginFactor = 0.6 + 0.8 * Math.min(1, marginShare);
  const teams = { A: { players: sideA, average: average(sideA) }, B: { players: sideB, average: average(sideB) } };

  return (["A", "B"] as const).flatMap((side) => {
    const team = teams[side];
    const opponents = teams[side === "A" ? "B" : "A"];
    const actual = result.winner === side ? 1 : 0;
    return team.players.map((player) => {
      const expected = expectedWin((player.rating + team.average) / 2, opponents.average);
      const k = RATING_K * (player.ratedMatches < PROVISIONAL_MATCHES ? 2 : 1);
      const after = round(Math.min(MAX_RATING, Math.max(MIN_RATING, player.rating + k * marginFactor * (actual - expected))));
      return { userId: player.userId, side, before: player.rating, after, delta: round(after - player.rating) };
    });
  });
}

export type ReplayMatch = { id: string; players: { userId: string; side: "A" | "B" }[]; scores: { sideAScore: number; sideBScore: number }[] };

/**
 * Rates `matches` in order from each player's starting rating, the way the app would have if every
 * score had been right first time. `adjustments` (by match id, then user id) are manual rating
 * changes to apply just before that match. Returns final ratings and each match's changes.
 */
export function replayRatings(starting: Map<string, number>, matches: ReplayMatch[], adjustments = new Map<string, Map<string, number>>()) {
  const ratings = new Map(starting);
  const rated = new Map<string, number>();
  const changes = new Map<string, RatingChange[]>();
  for (const match of matches) {
    for (const [userId, offset] of adjustments.get(match.id) ?? []) {
      if (ratings.has(userId)) ratings.set(userId, round(Math.min(MAX_RATING, Math.max(MIN_RATING, ratings.get(userId)! + offset))));
    }
    const result = matchResult(match.scores);
    if (!result) continue;
    const side = (letter: "A" | "B") => match.players.filter((player) => player.side === letter && ratings.has(player.userId)).map((player) => ({ userId: player.userId, rating: ratings.get(player.userId)!, ratedMatches: rated.get(player.userId) ?? 0 }));
    const matchChanges = rateMatch(side("A"), side("B"), result);
    if (!matchChanges.length) continue;
    for (const change of matchChanges) {
      ratings.set(change.userId, change.after);
      rated.set(change.userId, (rated.get(change.userId) ?? 0) + 1);
    }
    changes.set(match.id, matchChanges);
  }
  return { ratings, changes };
}
