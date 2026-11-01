import { winningSide } from "./achievements";

export type StreakMatch = { id: string; playedAt: Date; winnerSide: "A" | "B" | null; players: { userId: string; side: "A" | "B" }[]; scores: { gameNumber: number; sideAScore: number; sideBScore: number }[] };
export type WinStreaks = { best: { length: number; matchIds: string[] }; current: number };

/**
 * A player's longest run of matches won in a row, and the run they're on now. Matches are taken
 * oldest first, won the same way as the streak badges (a tie or loss ends a run). The most recent
 * run wins a tie for the longest.
 */
export function computeWinStreaks(matches: StreakMatch[], userId: string): WinStreaks {
  let run: string[] = [];
  let best: string[] = [];
  for (const match of [...matches].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime() || a.id.localeCompare(b.id))) {
    const mine = match.players.find((player) => player.userId === userId);
    if (!mine) continue;
    if (winningSide(match) === mine.side) {
      run = [...run, match.id];
      if (run.length >= best.length) best = run;
    } else run = [];
  }
  return { best: { length: best.length, matchIds: best }, current: run.length };
}
