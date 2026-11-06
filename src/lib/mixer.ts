/**
 * Mixer mode: a rotating-partner round robin built for social nights. Each round it arranges the
 * players who are on court so that
 *   1. nobody partners the same person twice (while that's still possible),
 *   2. strong players team up with newer ones, so every team is roughly the same strength,
 *   3. the two teams on each court are evenly matched, and
 *   4. opponents get mixed up too.
 * Who sits out is decided elsewhere (fewest games first); this only arranges who plays with whom.
 */

export type MixerPlayer = { id: string; rating: number };
/** One court: [teamA, teamB], each a pair of player ids. */
export type MixerMatch = [[string, string], [string, string]];

/** Who has already partnered or faced whom tonight, counted per pair. */
export type MixerHistory = { partners: Map<string, number>; opponents: Map<string, number> };

const REPEAT_PARTNER = 1000;
const TEAM_STRENGTH = 10;
const COURT_BALANCE = 20;
const REPEAT_OPPONENT = 1;

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function emptyMixerHistory(): MixerHistory {
  return { partners: new Map(), opponents: new Map() };
}

/** Adds played (or newly scheduled) matches to the history. */
export function recordMixerMatches(history: MixerHistory, matches: MixerMatch[]) {
  for (const [teamA, teamB] of matches) {
    for (const team of [teamA, teamB]) history.partners.set(pairKey(team[0], team[1]), (history.partners.get(pairKey(team[0], team[1])) ?? 0) + 1);
    for (const a of teamA) for (const b of teamB) history.opponents.set(pairKey(a, b), (history.opponents.get(pairKey(a, b)) ?? 0) + 1);
  }
}

/** Builds the history from a night's existing doubles matches (players tagged with side A/B). */
export function mixerHistoryFromMatches(matches: { players: { userId: string; side: string }[] }[]): MixerHistory {
  const history = emptyMixerHistory();
  const doubles: MixerMatch[] = [];
  for (const match of matches) {
    const teamA = match.players.filter((player) => player.side === "A").map((player) => player.userId);
    const teamB = match.players.filter((player) => player.side === "B").map((player) => player.userId);
    if (teamA.length === 2 && teamB.length === 2) doubles.push([[teamA[0], teamA[1]], [teamB[0], teamB[1]]]);
  }
  recordMixerMatches(history, doubles);
  return history;
}

/** How bad an arrangement is (lower is better). `order` holds 4 ids per court: A1 A2 B1 B2. */
export function mixerCost(order: string[], ratings: Map<string, number>, history: MixerHistory): number {
  const rating = (id: string) => ratings.get(id) ?? 0;
  const average = order.reduce((total, id) => total + rating(id), 0) / Math.max(order.length, 1);
  const fairTeam = average * 2;
  let cost = 0;
  for (let court = 0; court < order.length / 4; court++) {
    const [a1, a2, b1, b2] = order.slice(court * 4, court * 4 + 4);
    const teamA = rating(a1) + rating(a2);
    const teamB = rating(b1) + rating(b2);
    cost += REPEAT_PARTNER * ((history.partners.get(pairKey(a1, a2)) ?? 0) + (history.partners.get(pairKey(b1, b2)) ?? 0));
    cost += TEAM_STRENGTH * ((teamA - fairTeam) ** 2 + (teamB - fairTeam) ** 2);
    cost += COURT_BALANCE * (teamA - teamB) ** 2;
    for (const a of [a1, a2]) for (const b of [b1, b2]) cost += REPEAT_OPPONENT * (history.opponents.get(pairKey(a, b)) ?? 0);
  }
  return cost;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/** Strongest with weakest, then the resulting teams matched snake-style: a good starting point. */
function highLowSeed(players: MixerPlayer[]): string[] {
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const teams: [MixerPlayer, MixerPlayer][] = [];
  for (let i = 0; i < sorted.length / 2; i++) teams.push([sorted[i], sorted[sorted.length - 1 - i]]);
  teams.sort((a, b) => b[0].rating + b[1].rating - (a[0].rating + a[1].rating));
  const order: string[] = [];
  for (let i = 0; i < teams.length; i += 2) order.push(teams[i][0].id, teams[i][1].id, teams[i + 1][0].id, teams[i + 1][1].id);
  return order;
}

/**
 * Arranges these players (a multiple of four) onto courts for one round. Runs a few restarts of a
 * swap-based local search from the high-low seed and random starts, keeping the cheapest result.
 */
export function planMixerRound(players: MixerPlayer[], history: MixerHistory, random: () => number = Math.random): MixerMatch[] {
  const count = players.length - (players.length % 4);
  if (count < 4) return [];
  const ratings = new Map(players.map((player) => [player.id, player.rating]));
  const onCourt = players.slice(0, count);

  let best = highLowSeed(onCourt);
  let bestCost = mixerCost(best, ratings, history);
  const restarts = 12;
  const swapsPerRestart = 40 * count;
  for (let restart = 0; restart < restarts; restart++) {
    const order = restart === 0 ? [...best] : shuffle(onCourt.map((player) => player.id), random);
    let cost = mixerCost(order, ratings, history);
    for (let step = 0; step < swapsPerRestart; step++) {
      const i = Math.floor(random() * count);
      const j = Math.floor(random() * count);
      if (i === j) continue;
      [order[i], order[j]] = [order[j], order[i]];
      const next = mixerCost(order, ratings, history);
      if (next <= cost) cost = next;
      else [order[i], order[j]] = [order[j], order[i]];
    }
    if (cost < bestCost) {
      best = order;
      bestCost = cost;
    }
  }

  const matches: MixerMatch[] = [];
  for (let court = 0; court < count / 4; court++) {
    const [a1, a2, b1, b2] = best.slice(court * 4, court * 4 + 4);
    matches.push([[a1, a2], [b1, b2]]);
  }
  return matches;
}
