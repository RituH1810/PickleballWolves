import { winningSide } from "./achievements";

export type RevengeHistoryMatch = { id: string; playedAt: Date; winnerSide: "A" | "B" | null; players: { userId: string; side: "A" | "B" }[]; scores: { gameNumber: number; sideAScore: number; sideBScore: number }[] };
export type UpcomingMatch = { id: string; players: { userId: string; side: "A" | "B" }[] };
export type Rematch = { matchId: string; opponentIds: string[]; wins: number; losses: number; lastScore: [number, number] };

/** A stable key for a set of opponents, so the same pair is only called out once per event. */
export const opponentKey = (opponentIds: string[]) => [...opponentIds].sort().join(",");

/**
 * The upcoming matches where `userId` faces exactly the opponents who beat them the last time they
 * met (any partner) and have the better of them overall. Each comes with the all-time record against that opponent side and the
 * last score from the player's side.
 */
export function findRematches(upcoming: UpcomingMatch[], history: RevengeHistoryMatch[], userId: string): Rematch[] {
  const played = [...history].filter((match) => match.scores.length).sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime() || a.id.localeCompare(b.id));
  const rematches: Rematch[] = [];
  const seen = new Set<string>();
  for (const match of upcoming) {
    const side = match.players.find((player) => player.userId === userId)?.side;
    if (!side) continue;
    const opponentIds = match.players.filter((player) => player.side !== side).map((player) => player.userId);
    const key = opponentKey(opponentIds);
    if (!opponentIds.length || seen.has(key)) continue;
    let wins = 0;
    let losses = 0;
    let last: { won: boolean; score: [number, number] } | null = null;
    for (const past of played) {
      const mySide = past.players.find((player) => player.userId === userId)?.side;
      if (!mySide) continue;
      const theirs = past.players.filter((player) => player.side !== mySide).map((player) => player.userId);
      if (opponentKey(theirs) !== key) continue;
      const winner = winningSide(past);
      if (!winner) continue;
      const won = winner === mySide;
      if (won) wins += 1; else losses += 1;
      const mine = past.scores.reduce((total, score) => total + (mySide === "A" ? score.sideAScore : score.sideBScore), 0);
      const other = past.scores.reduce((total, score) => total + (mySide === "A" ? score.sideBScore : score.sideAScore), 0);
      last = { won, score: [mine, other] };
    }
    if (last && !last.won && losses > wins) {
      seen.add(key);
      rematches.push({ matchId: match.id, opponentIds, wins, losses, lastScore: last.score });
    }
  }
  return rematches;
}

/** "Avinash & Prem" from opponent ids. */
const namesOf = (ids: string[], names: Map<string, string>) => ids.map((id) => (names.get(id) ?? "them").split(" ")[0]).join(" & ");

/** The push for one player's rematches at an event (one push, however many rematches). */
export function revengeMessage(rematches: Rematch[], names: Map<string, string>, eventName: string) {
  if (rematches.length === 1) {
    const [rematch] = rematches;
    const who = namesOf(rematch.opponentIds, names);
    return {
      title: `Rematch vs ${who} 😤`,
      body: `${who} beat you ${rematch.lastScore[1]}-${rematch.lastScore[0]} last time (you're ${rematch.wins}-${rematch.losses} against them). You face them again at ${eventName}. Time to get even.`,
    };
  }
  return {
    title: `${rematches.length} rematches at ${eventName} 😤`,
    body: `${rematches.map((rematch) => `vs ${namesOf(rematch.opponentIds, names)} (${rematch.wins}-${rematch.losses})`).join(", ")}. They all beat you last time. Time to get even.`,
  };
}
