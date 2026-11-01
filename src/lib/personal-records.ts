import { winningSide } from "./achievements";

export type RecordMatch = { id: string; playedAt: Date; roundRobin: { id: string; name: string } | null; winnerSide: "A" | "B" | null; players: { userId: string; side: "A" | "B" }[]; scores: { gameNumber: number; sideAScore: number; sideBScore: number }[] };
export type PersonalRecord = { key: "biggestWin" | "bestNight" | "longestMatch" | "ratingJump"; label: string; value: string; detail: string; at: Date; matchIds: string[]; roundRobin: { id: string; name: string } | null };

/**
 * A player's personal bests: biggest win (by total points), most wins in one round robin, longest
 * match (most points played) and biggest rating gain from one match (`ratingDeltas` by match id). The first match to set a record
 * keeps it. A record they haven't set yet is left out.
 */
export function computePersonalRecords(matches: RecordMatch[], userId: string, ratingDeltas = new Map<string, number>()): PersonalRecord[] {
  const played = [...matches].filter((match) => match.scores.length).sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime() || a.id.localeCompare(b.id));
  let biggest: { match: RecordMatch; mine: number; theirs: number } | null = null;
  let longest: { match: RecordMatch; total: number; games: number } | null = null;
  let jump: { match: RecordMatch; delta: number; mine: number; theirs: number } | null = null;
  const nights = new Map<string, { roundRobin: { id: string; name: string }; wins: number; losses: number; matchIds: string[]; at: Date }>();

  for (const match of played) {
    const side = match.players.find((player) => player.userId === userId)?.side;
    if (!side) continue;
    const games = [...match.scores].sort((a, b) => a.gameNumber - b.gameNumber).map((score) => ({ mine: side === "A" ? score.sideAScore : score.sideBScore, theirs: side === "A" ? score.sideBScore : score.sideAScore }));
    const mine = games.reduce((total, game) => total + game.mine, 0);
    const theirs = games.reduce((total, game) => total + game.theirs, 0);
    const winner = winningSide(match);
    const won = winner === side;

    if (won && (!biggest || mine - theirs > biggest.mine - biggest.theirs)) biggest = { match, mine, theirs };
    if (!longest || mine + theirs > longest.total) longest = { match, total: mine + theirs, games: games.length };
    const delta = ratingDeltas.get(match.id);
    if (delta !== undefined && delta > 0 && (!jump || delta > jump.delta)) jump = { match, delta, mine, theirs };

    if (match.roundRobin && winner) {
      const night = nights.get(match.roundRobin.id) ?? { roundRobin: match.roundRobin, wins: 0, losses: 0, matchIds: [], at: match.playedAt };
      if (won) night.wins += 1; else night.losses += 1;
      night.matchIds.push(match.id);
      night.at = match.playedAt;
      nights.set(match.roundRobin.id, night);
    }
  }

  const records: PersonalRecord[] = [];
  const score = (match: RecordMatch) => match.scores.length === 1 ? "" : ` over ${match.scores.length} games`;
  if (biggest) records.push({ key: "biggestWin", label: "Biggest win", value: `+${biggest.mine - biggest.theirs}`, detail: `${biggest.mine}-${biggest.theirs}${score(biggest.match)}`, at: biggest.match.playedAt, matchIds: [biggest.match.id], roundRobin: null });
  const best = [...nights.values()].sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.at.getTime() - b.at.getTime())[0];
  if (best?.wins) records.push({ key: "bestNight", label: "Most wins in a night", value: String(best.wins), detail: `${best.wins}-${best.losses} at ${best.roundRobin.name}`, at: best.at, matchIds: best.matchIds, roundRobin: best.roundRobin });
  if (longest) records.push({ key: "longestMatch", label: "Longest match", value: `${longest.total} pts`, detail: `${longest.total} points played${longest.games > 1 ? ` over ${longest.games} games` : ""}`, at: longest.match.playedAt, matchIds: [longest.match.id], roundRobin: null });
  if (jump) records.push({ key: "ratingJump", label: "Biggest rating jump", value: `+${jump.delta.toFixed(3)}`, detail: `From one match, ${jump.mine > jump.theirs ? "won" : "lost"} ${jump.mine}-${jump.theirs}`, at: jump.match.playedAt, matchIds: [jump.match.id], roundRobin: null });
  return records;
}
