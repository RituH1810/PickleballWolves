/** How many recent results the form guide shows. */
export const FORM_LENGTH = 5;

export type FormMatch = { playedAt: Date; players: { userId: string; side: "A" | "B" }[]; scores: { sideAScore: number; sideBScore: number }[] };
export type FormResult = "W" | "L";
type Record = { wins: number; losses: number };

/** Whether `userId` won this match on total points, like leaderboards; null if they weren't in it or it was level/unscored. */
function resultFor(match: FormMatch, userId: string): FormResult | null {
  const side = match.players.find((player) => player.userId === userId)?.side;
  if (!side || !match.scores.length) return null;
  const mine = match.scores.reduce((total, score) => total + (side === "A" ? score.sideAScore : score.sideBScore), 0);
  const theirs = match.scores.reduce((total, score) => total + (side === "A" ? score.sideBScore : score.sideAScore), 0);
  return mine === theirs ? null : mine > theirs ? "W" : "L";
}

/** A player's last FORM_LENGTH results, newest first, and their current run (e.g. 3 wins in a row). */
export function recentForm(matches: FormMatch[], userId: string) {
  const results = [...matches]
    .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())
    .map((match) => resultFor(match, userId))
    .filter((result): result is FormResult => result !== null);
  let length = 0;
  while (length < results.length && results[length] === results[0]) length += 1;
  return { results: results.slice(0, FORM_LENGTH), streak: results.length ? { result: results[0], length } : null };
}

/** `me`'s record against `them` (on opposite sides) and with them (as partners). */
export function headToHead(matches: FormMatch[], me: string, them: string) {
  const against: Record = { wins: 0, losses: 0 };
  const together: Record = { wins: 0, losses: 0 };
  for (const match of matches) {
    const mySide = match.players.find((player) => player.userId === me)?.side;
    const theirSide = match.players.find((player) => player.userId === them)?.side;
    const result = resultFor(match, me);
    if (!mySide || !theirSide || !result) continue;
    const record = mySide === theirSide ? together : against;
    record[result === "W" ? "wins" : "losses"] += 1;
  }
  return { against, together };
}
