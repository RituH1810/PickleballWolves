import { isUpset, predictMatch } from "./match-prediction";
import { sideTotals, type RivalryMatch } from "./rivalry";

/** A game won or lost by this many points or fewer is a close game. */
export const CLOSE_GAME_MARGIN = 2;
/** Close games needed before a player is called clutch (or not). */
export const CLUTCH_MIN_GAMES = 5;
/** How much better than their overall game win % a player's close-game win % must be to count as clutch. */
const CLUTCH_EDGE = 10;

type Record = { wins: number; losses: number };
export type ClutchStats = {
  overall: Record & { winPct: number };
  close: Record & { winPct: number };
  /** Matches where the other side was favored going in (ratings at the time). */
  underdog: Record;
  upsetWins: number;
  /** Multi-game matches won after losing the first game, out of multi-game matches played. */
  comebacks: { wins: number; chances: number };
  verdict: "clutch" | "steady" | "shaky" | null;
};

const pct = (record: Record) => (record.wins + record.losses ? Math.round((record.wins / (record.wins + record.losses)) * 100) : 0);

/**
 * How a player does when it's tight: close games (by game), matches as the underdog and upsets
 * (from the ratings everyone had going in, keyed "matchId:userId"; unrated matches are left out),
 * and comebacks after dropping the first game. Matches are won on total points, like leaderboards.
 */
export function computeClutch(matches: RivalryMatch[], userId: string, ratingBefore: Map<string, number>): ClutchStats {
  const overall = { wins: 0, losses: 0 }, close = { wins: 0, losses: 0 }, underdog = { wins: 0, losses: 0 };
  let upsetWins = 0, comebackWins = 0, comebackChances = 0;

  for (const match of matches) {
    const side = match.players.find((player) => player.userId === userId)?.side;
    if (!side || !match.scores.length) continue;
    for (const score of match.scores) {
      const mine = side === "A" ? score.sideAScore : score.sideBScore;
      const theirs = side === "A" ? score.sideBScore : score.sideAScore;
      if (mine === theirs) continue;
      const record = mine > theirs ? "wins" : "losses";
      overall[record] += 1;
      if (Math.abs(mine - theirs) <= CLOSE_GAME_MARGIN) close[record] += 1;
    }

    const mineTotal = sideTotals(match, side);
    const theirTotal = sideTotals(match, side === "A" ? "B" : "A");
    if (mineTotal === theirTotal) continue;
    const won = mineTotal > theirTotal;

    const ratings = (letter: "A" | "B") => match.players.filter((player) => player.side === letter).map((player) => ratingBefore.get(`${match.id}:${player.userId}`));
    const [sideA, sideB] = [ratings("A"), ratings("B")];
    const prediction = [...sideA, ...sideB].every((rating) => rating !== undefined) ? predictMatch(sideA as number[], sideB as number[]) : null;
    if (prediction?.favorite && prediction.favorite !== side) underdog[won ? "wins" : "losses"] += 1;
    if (won && isUpset(prediction, side)) upsetWins += 1;

    if (match.scores.length > 1) {
      const first = match.scores[0];
      const lostFirst = (side === "A" ? first.sideAScore : first.sideBScore) < (side === "A" ? first.sideBScore : first.sideAScore);
      if (lostFirst) {
        comebackChances += 1;
        if (won) comebackWins += 1;
      }
    }
  }

  const closeGames = close.wins + close.losses;
  const edge = pct(close) - pct(overall);
  const verdict = closeGames < CLUTCH_MIN_GAMES ? null : edge >= CLUTCH_EDGE ? "clutch" : edge <= -CLUTCH_EDGE ? "shaky" : "steady";
  return { overall: { ...overall, winPct: pct(overall) }, close: { ...close, winPct: pct(close) }, underdog, upsetWins, comebacks: { wins: comebackWins, chances: comebackChances }, verdict };
}
