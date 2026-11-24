import { winningSide } from "./achievements";

export type StreakMatch = { id: string; playedAt: Date; winnerSide: "A" | "B" | null; players: { userId: string; side: "A" | "B" }[]; scores: { gameNumber: number; sideAScore: number; sideBScore: number }[] };
export type StreakRun = { length: number; start: Date; end: Date; ongoing: boolean };
export type WinStreaks = { best: { length: number; matchIds: string[] }; current: number; top: StreakRun[] };

/** How many separate streaks the "top streaks" lists show, and the shortest run that counts. */
export const TOP_STREAKS = 5;
export const TOP_STREAK_MIN = 2;

/**
 * A player's longest separate runs of wins from their results in order (oldest first): each run
 * counted once at its full length, longest first, earlier runs first on ties. A run still going
 * is marked ongoing.
 */
export function topStreakRuns(results: { won: boolean; at: Date }[], limit = TOP_STREAKS, min = TOP_STREAK_MIN): StreakRun[] {
  const runs: StreakRun[] = [];
  let current: StreakRun | null = null;
  for (const result of results) {
    if (result.won) {
      if (current) { current.length += 1; current.end = result.at; } else current = { length: 1, start: result.at, end: result.at, ongoing: false };
    } else if (current) {
      runs.push(current);
      current = null;
    }
  }
  if (current) runs.push({ ...current, ongoing: true });
  return runs.filter((run) => run.length >= min).sort((a, b) => b.length - a.length || a.start.getTime() - b.start.getTime()).slice(0, limit);
}

/**
 * A player's longest run of matches won in a row, and the run they're on now. Matches are taken
 * oldest first, won the same way as the streak badges (a tie or loss ends a run). The most recent
 * run wins a tie for the longest.
 */
export function computeWinStreaks(matches: StreakMatch[], userId: string): WinStreaks {
  let run: string[] = [];
  let best: string[] = [];
  const results: { won: boolean; at: Date }[] = [];
  for (const match of [...matches].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime() || a.id.localeCompare(b.id))) {
    const mine = match.players.find((player) => player.userId === userId);
    if (!mine) continue;
    results.push({ won: winningSide(match) === mine.side, at: match.playedAt });
    if (winningSide(match) === mine.side) {
      run = [...run, match.id];
      if (run.length >= best.length) best = run;
    } else run = [];
  }
  return { best: { length: best.length, matchIds: best }, current: run.length, top: topStreakRuns(results) };
}
