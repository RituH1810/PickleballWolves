export type RivalryMatch = {
  id: string;
  playedAt: Date;
  event: string;
  players: { userId: string; name: string; side: "A" | "B" }[];
  scores: { sideAScore: number; sideBScore: number }[];
};

export type Meeting = {
  id: string;
  playedAt: Date;
  event: string;
  winner: "a" | "b";
  /** Points per game from player A's side, e.g. [[11, 7], [9, 11]]. */
  games: [number, number][];
  margin: number;
  partnersA: string[];
  partnersB: string[];
};

/** Who won a match, by total points (the same rule as leaderboards and head-to-head). */
export function sideTotals(match: RivalryMatch, side: "A" | "B") {
  return match.scores.reduce((total, score) => total + (side === "A" ? score.sideAScore : score.sideBScore), 0);
}

/** Longest run of consecutive wins for one player, oldest to newest. */
function longestStreak(meetings: Meeting[], who: "a" | "b") {
  let best = 0;
  let run = 0;
  for (const meeting of meetings) {
    run = meeting.winner === who ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/**
 * Two players' rivalry: every scored match where they were on opposite sides (tied totals are
 * skipped), plus their record when they partnered. Meetings come back newest first.
 */
export function computeRivalry(matches: RivalryMatch[], a: string, b: string) {
  const meetings: Meeting[] = [];
  let togetherWins = 0;
  let togetherLosses = 0;
  for (const match of matches) {
    const sideA = match.players.find((player) => player.userId === a)?.side;
    const sideB = match.players.find((player) => player.userId === b)?.side;
    if (!sideA || !sideB || !match.scores.length) continue;
    const mine = sideTotals(match, sideA);
    const theirs = sideTotals(match, sideA === "A" ? "B" : "A");
    if (mine === theirs) continue;
    if (sideA === sideB) {
      if (mine > theirs) togetherWins += 1; else togetherLosses += 1;
      continue;
    }
    meetings.push({
      id: match.id,
      playedAt: match.playedAt,
      event: match.event,
      winner: mine > theirs ? "a" : "b",
      games: match.scores.map((score) => (sideA === "A" ? [score.sideAScore, score.sideBScore] : [score.sideBScore, score.sideAScore])),
      margin: Math.abs(mine - theirs),
      partnersA: match.players.filter((player) => player.side === sideA && player.userId !== a).map((player) => player.name),
      partnersB: match.players.filter((player) => player.side === sideB && player.userId !== b).map((player) => player.name),
    });
  }

  const oldestFirst = [...meetings].sort((x, y) => x.playedAt.getTime() - y.playedAt.getTime());
  const newestFirst = [...oldestFirst].reverse();
  let current = 0;
  const currentHolder = newestFirst[0]?.winner ?? null;
  for (const meeting of newestFirst) { if (meeting.winner !== currentHolder) break; current += 1; }
  const winsA = meetings.filter((meeting) => meeting.winner === "a").length;
  const biggest = (who: "a" | "b") => meetings.filter((meeting) => meeting.winner === who).sort((x, y) => y.margin - x.margin)[0] ?? null;

  return {
    played: meetings.length,
    winsA,
    winsB: meetings.length - winsA,
    pointsA: meetings.reduce((total, meeting) => total + meeting.games.reduce((sum, [mine]) => sum + mine, 0), 0),
    pointsB: meetings.reduce((total, meeting) => total + meeting.games.reduce((sum, [, theirs]) => sum + theirs, 0), 0),
    currentStreak: currentHolder ? { who: currentHolder, length: current } : null,
    longestStreakA: longestStreak(oldestFirst, "a"),
    longestStreakB: longestStreak(oldestFirst, "b"),
    closest: [...meetings].sort((x, y) => x.margin - y.margin || y.playedAt.getTime() - x.playedAt.getTime())[0] ?? null,
    biggestWinA: biggest("a"),
    biggestWinB: biggest("b"),
    firstMeeting: oldestFirst[0]?.playedAt ?? null,
    lastMeeting: newestFirst[0]?.playedAt ?? null,
    together: { wins: togetherWins, losses: togetherLosses },
    meetings: newestFirst,
  };
}

export type Rivalry = ReturnType<typeof computeRivalry>;

/** Fewest meetings before someone counts as your rival. */
export const RIVAL_MIN_MEETINGS = 5;

/**
 * The opponent a player has faced most (ties go to the closer record), with their record against
 * them -- or null until they've met someone RIVAL_MIN_MEETINGS times.
 */
export function findTopRival(matches: RivalryMatch[], userId: string) {
  const faced = new Map<string, { name: string; wins: number; losses: number }>();
  for (const match of matches) {
    const side = match.players.find((player) => player.userId === userId)?.side;
    if (!side || !match.scores.length) continue;
    const mine = sideTotals(match, side);
    const theirs = sideTotals(match, side === "A" ? "B" : "A");
    if (mine === theirs) continue;
    for (const opponent of match.players.filter((player) => player.side !== side)) {
      const entry = faced.get(opponent.userId) ?? { name: opponent.name, wins: 0, losses: 0 };
      if (mine > theirs) entry.wins += 1; else entry.losses += 1;
      faced.set(opponent.userId, entry);
    }
  }
  const [best] = [...faced]
    .map(([id, entry]) => ({ userId: id, ...entry, played: entry.wins + entry.losses }))
    .filter((entry) => entry.played >= RIVAL_MIN_MEETINGS)
    .sort((x, y) => y.played - x.played || Math.abs(x.wins - x.losses) - Math.abs(y.wins - y.losses));
  return best ?? null;
}
