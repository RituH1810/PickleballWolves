import { winningSide } from "./achievements";

/** Fewest meetings in a month for two players to be the month's rivalry. */
export const RIVALRY_MIN_MEETINGS = 4;

export type RivalryMonthMatch = { id: string; playedAt: Date; winnerSide: "A" | "B" | null; players: { userId: string; side: "A" | "B" }[]; scores: { gameNumber: number; sideAScore: number; sideBScore: number }[] };
export type MonthlyRivalry = { a: string; b: string; aWins: number; bWins: number; meetings: number; last: { matchId: string; winner: string; score: [number, number]; playedAt: Date } };

/**
 * The closest head-to-head (player vs player, on opposite sides) in these matches: the smallest
 * gap in wins among pairs who met RIVALRY_MIN_MEETINGS+ times, then the most meetings, then the
 * most recent. Guests are left out. `last.score` is from the last winner's side.
 */
export function computeMonthlyRivalry(matches: RivalryMonthMatch[], guestIds = new Set<string>()): MonthlyRivalry | null {
  const pairs = new Map<string, MonthlyRivalry>();
  const ordered = [...matches].sort((x, y) => x.playedAt.getTime() - y.playedAt.getTime() || x.id.localeCompare(y.id));
  for (const match of ordered) {
    const winner = winningSide(match);
    if (!winner || !match.scores.length) continue;
    const total = (side: "A" | "B") => match.scores.reduce((sum, score) => sum + (side === "A" ? score.sideAScore : score.sideBScore), 0);
    const sideA = match.players.filter((player) => player.side === "A" && !guestIds.has(player.userId));
    const sideB = match.players.filter((player) => player.side === "B" && !guestIds.has(player.userId));
    for (const one of sideA) {
      for (const two of sideB) {
        const [a, b] = one.userId < two.userId ? [one, two] : [two, one];
        const key = `${a.userId}|${b.userId}`;
        const pair = pairs.get(key) ?? { a: a.userId, b: b.userId, aWins: 0, bWins: 0, meetings: 0, last: null as unknown as MonthlyRivalry["last"] };
        const winnerId = a.side === winner ? a.userId : b.userId;
        if (winnerId === a.userId) pair.aWins += 1; else pair.bWins += 1;
        pair.meetings += 1;
        const loser = winner === "A" ? "B" : "A";
        pair.last = { matchId: match.id, winner: winnerId, score: [total(winner), total(loser)], playedAt: match.playedAt };
        pairs.set(key, pair);
      }
    }
  }
  return [...pairs.values()]
    .filter((pair) => pair.meetings >= RIVALRY_MIN_MEETINGS)
    .sort((x, y) => Math.abs(x.aWins - x.bWins) - Math.abs(y.aWins - y.bWins) || y.meetings - x.meetings || y.last.playedAt.getTime() - x.last.playedAt.getTime())[0] ?? null;
}
