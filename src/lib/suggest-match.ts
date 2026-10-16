export type SuggestPlayer = { id: string; rating: number };
export type SuggestMatch = { createdAt: string | Date; scored: boolean; players: { userId: string; side: "A" | "B" }[] };
export type Suggestion = { teamA: string[]; teamB: string[]; ratingGap: number; repeats: number };

// Only the longest-waiting few are worth considering; beyond that the search buys nothing.
const CANDIDATE_POOL = 8;
// Fair teams come first: a lopsided game is worse than a repeat, and small nights can't avoid
// repeats anyway. A 0.5 rating gap costs as much as repeating 2-3 partnerships.
const RATING_WEIGHT = 10; // per rating point of gap between team averages
const REPEAT_PARTNER_WEIGHT = 2;
const REPEAT_OPPONENT_WEIGHT = 0.5;
const REMATCH_WEIGHT = 8; // the exact same two teams again
const WAIT_WEIGHT = 2; // per place down the waiting order

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  return [...combinations(rest, size - 1).map((combo) => [first, ...combo]), ...combinations(rest, size)];
}

/**
 * Ranked next-match suggestions for a Dink Draft night. Players in a match that hasn't been
 * scored yet are on court and skipped. The rest are ordered by who has played least, then who has
 * waited longest; among the front of that line, each possible pairing is scored on how fair the
 * teams are (average rating), how many partners/opponents repeat from earlier tonight, and how
 * far down the waiting order it reaches. Best first.
 */
export function suggestMatches(players: SuggestPlayer[], matches: SuggestMatch[], teamSize: 1 | 2, limit = 5): Suggestion[] {
  const busy = new Set(matches.filter((match) => !match.scored).flatMap((match) => match.players.map((player) => player.userId)));
  const played = new Map<string, number>();
  const lastPlayed = new Map<string, number>();
  const partnered = new Map<string, number>();
  const faced = new Map<string, number>();
  const pairKey = (a: string, b: string) => [a, b].sort().join("|");
  const matchupKey = (teamA: string[], teamB: string[]) => [teamA.slice().sort().join("+"), teamB.slice().sort().join("+")].sort().join(" v ");
  const matchups = new Map<string, number>();
  for (const match of matches) {
    const at = new Date(match.createdAt).getTime();
    const key = matchupKey(match.players.filter((player) => player.side === "A").map((player) => player.userId), match.players.filter((player) => player.side === "B").map((player) => player.userId));
    matchups.set(key, (matchups.get(key) ?? 0) + 1);
    for (const player of match.players) {
      played.set(player.userId, (played.get(player.userId) ?? 0) + 1);
      lastPlayed.set(player.userId, Math.max(lastPlayed.get(player.userId) ?? 0, at));
      for (const other of match.players) {
        if (other.userId <= player.userId) continue;
        const map = other.side === player.side ? partnered : faced;
        map.set(pairKey(player.userId, other.userId), (map.get(pairKey(player.userId, other.userId)) ?? 0) + 1);
      }
    }
  }

  const waiting = players
    .filter((player) => !busy.has(player.id))
    .sort((a, b) => (played.get(a.id) ?? 0) - (played.get(b.id) ?? 0) || (lastPlayed.get(a.id) ?? 0) - (lastPlayed.get(b.id) ?? 0) || a.id.localeCompare(b.id))
    .slice(0, CANDIDATE_POOL);
  const needed = teamSize * 2;
  if (waiting.length < needed) return [];
  const place = new Map(waiting.map((player, index) => [player.id, index]));
  const rating = new Map(waiting.map((player) => [player.id, player.rating]));
  const average = (ids: string[]) => ids.reduce((total, id) => total + (rating.get(id) ?? 0), 0) / ids.length;

  const options: (Suggestion & { cost: number })[] = [];
  for (const group of combinations(waiting.map((player) => player.id), needed)) {
    // Every way to split the group into two teams, counting each split once.
    const splits = teamSize === 1 ? [[[group[0]], [group[1]]]] : [[[group[0], group[1]], [group[2], group[3]]], [[group[0], group[2]], [group[1], group[3]]], [[group[0], group[3]], [group[1], group[2]]]];
    const waitCost = group.reduce((total, id) => total + (place.get(id) ?? 0), 0) - (needed * (needed - 1)) / 2;
    for (const [teamA, teamB] of splits) {
      const ratingGap = Math.abs(average(teamA) - average(teamB));
      const partnerRepeats = teamSize === 2 ? (partnered.get(pairKey(teamA[0], teamA[1])) ?? 0) + (partnered.get(pairKey(teamB[0], teamB[1])) ?? 0) : 0;
      const opponentRepeats = teamA.reduce((total, a) => total + teamB.reduce((sum, b) => sum + (faced.get(pairKey(a, b)) ?? 0), 0), 0);
      const rematches = matchups.get(matchupKey(teamA, teamB)) ?? 0;
      const cost = WAIT_WEIGHT * waitCost + RATING_WEIGHT * ratingGap + REPEAT_PARTNER_WEIGHT * partnerRepeats + REPEAT_OPPONENT_WEIGHT * opponentRepeats + REMATCH_WEIGHT * rematches;
      options.push({ teamA, teamB, ratingGap: Math.round(ratingGap * 100) / 100, repeats: partnerRepeats + opponentRepeats, cost });
    }
  }
  return options.sort((a, b) => a.cost - b.cost).slice(0, limit).map(({ teamA, teamB, ratingGap, repeats }) => ({ teamA, teamB, ratingGap, repeats }));
}
