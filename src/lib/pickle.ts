/**
 * A "pickle" is a game won without the other side scoring a point (11-0, 15-0...). Everything
 * here is worked out from saved scores, so nothing extra is stored.
 */

/** Pickles a player needs to serve for the Pickle Jar badge. */
export const PICKLE_JAR_TARGET = 5;

/** The side that served a pickle in this game, or null when it wasn't one. */
export function pickleWinner(score: { sideAScore: number; sideBScore: number }): "A" | "B" | null {
  if (score.sideAScore > 0 && score.sideBScore === 0) return "A";
  if (score.sideBScore > 0 && score.sideAScore === 0) return "B";
  return null;
}

/** True when the side with these points won the game as a pickle. */
export const isPickle = (mine: number, theirs: number) => mine > 0 && theirs === 0;

export type PickleTally = { served: number; taken: number; servedMatchIds: string[]; lastServedAt: Date | null };

/** How many pickles a player has served and been on the wrong end of, across these matches. */
export function pickleTally(matches: { id: string; playedAt: Date; players: { userId: string; side: "A" | "B" }[]; scores: { sideAScore: number; sideBScore: number }[] }[], userId: string): PickleTally {
  const tally: PickleTally = { served: 0, taken: 0, servedMatchIds: [], lastServedAt: null };
  for (const match of [...matches].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime())) {
    const side = match.players.find((player) => player.userId === userId)?.side;
    if (!side) continue;
    for (const score of match.scores) {
      const winner = pickleWinner(score);
      if (!winner) continue;
      if (winner === side) {
        tally.served += 1;
        if (!tally.servedMatchIds.includes(match.id)) tally.servedMatchIds.push(match.id);
        tally.lastServedAt = match.playedAt;
      } else tally.taken += 1;
    }
  }
  return tally;
}

const names = (players: { name: string }[]) => players.map((player) => player.name).join(" & ");

/** One line for a pickle, e.g. "Asha & Ben pickled Cam & Dee 11-0". */
export function pickleLine(winners: { name: string }[], losers: { name: string }[], winnerScore: number) {
  return `${names(winners)} pickled ${names(losers) || "their opponents"} ${winnerScore}-0`;
}
