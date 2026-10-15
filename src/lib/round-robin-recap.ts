export type RecapMatch = {
  id: string;
  players: { userId: string; name: string; side: "A" | "B" }[];
  scores: { gameNumber: number; sideAScore: number; sideBScore: number }[];
};

export type Standing = { rank: number; userId: string; name: string; wins: number; losses: number; scored: number; conceded: number; matches: number; winPct: number; differential: number };

/**
 * Round robin standings: every scored game counts as a win or loss for each player in it, ranked
 * by wins then point differential. Shared by the standings panel and the recap so they agree.
 */
export function computeRoundRobinStandings(matches: RecapMatch[]): Standing[] {
  const stats = new Map<string, { userId: string; name: string; wins: number; losses: number; scored: number; conceded: number }>();
  for (const match of matches) for (const player of match.players) if (!stats.has(player.userId)) stats.set(player.userId, { userId: player.userId, name: player.name, wins: 0, losses: 0, scored: 0, conceded: 0 });
  for (const match of matches) {
    for (const score of match.scores) {
      for (const player of match.players) {
        const entry = stats.get(player.userId)!;
        const own = player.side === "A" ? score.sideAScore : score.sideBScore;
        const other = player.side === "A" ? score.sideBScore : score.sideAScore;
        entry.scored += own;
        entry.conceded += other;
        if (own > other) entry.wins += 1; else entry.losses += 1;
      }
    }
  }
  return [...stats.values()].sort((a, b) => b.wins - a.wins || (b.scored - b.conceded) - (a.scored - a.conceded)).map((entry, index) => {
    const played = entry.wins + entry.losses;
    return { rank: index + 1, ...entry, matches: played, winPct: played ? Math.round((entry.wins / played) * 100) : 0, differential: entry.scored - entry.conceded };
  });
}

type PlayerRef = { userId: string; name: string };
type GameHighlight = { matchId: string; winners: PlayerRef[]; losers: PlayerRef[]; winnerScore: number; loserScore: number };
type PlayerHighlight = PlayerRef & { value: number };

export type Recap = {
  champions: Standing[];
  podium: Standing[];
  undefeated: boolean;
  totals: { players: number; games: number; points: number };
  biggestWin: GameHighlight | null;
  closestGame: GameHighlight | null;
  shutouts: number;
  topScorer: PlayerHighlight | null;
  biggestRatingGain: PlayerHighlight | null;
};

function names(players: PlayerRef[]) {
  return players.map((player) => player.name).join(" & ");
}

/** Headline numbers for a finished round robin. Unscored matches are ignored. */
export function computeRecap(matches: RecapMatch[], ratingDeltas: { userId: string; matchId: string | null; ratingDelta: number }[] = []): Recap | null {
  const scored = matches.filter((match) => match.scores.length > 0);
  if (!scored.length) return null;
  const standings = computeRoundRobinStandings(scored);
  const leader = standings[0];
  // Ties on both wins and differential share the title rather than being split by name order.
  const champions = standings.filter((entry) => entry.wins === leader.wins && entry.differential === leader.differential);

  const games: GameHighlight[] = [];
  for (const match of scored) {
    const sideA = match.players.filter((player) => player.side === "A").map(({ userId, name }) => ({ userId, name }));
    const sideB = match.players.filter((player) => player.side === "B").map(({ userId, name }) => ({ userId, name }));
    for (const score of match.scores) {
      if (score.sideAScore === score.sideBScore) continue;
      const aWon = score.sideAScore > score.sideBScore;
      games.push({ matchId: match.id, winners: aWon ? sideA : sideB, losers: aWon ? sideB : sideA, winnerScore: Math.max(score.sideAScore, score.sideBScore), loserScore: Math.min(score.sideAScore, score.sideBScore) });
    }
  }
  const margin = (game: GameHighlight) => game.winnerScore - game.loserScore;
  const biggestWin = games.reduce<GameHighlight | null>((best, game) => !best || margin(game) > margin(best) ? game : best, null);
  // Ties go to the higher-scoring game: 13-11 is more of a nail-biter than 5-3.
  const closestGame = games.reduce<GameHighlight | null>((best, game) => !best || margin(game) < margin(best) || (margin(game) === margin(best) && game.winnerScore > best.winnerScore) ? game : best, null);

  const scorer = [...standings].sort((a, b) => b.scored - a.scored)[0];
  const matchIds = new Set(scored.map((match) => match.id));
  const gains = new Map<string, number>();
  for (const row of ratingDeltas) if (row.matchId && matchIds.has(row.matchId)) gains.set(row.userId, (gains.get(row.userId) ?? 0) + row.ratingDelta);
  const [gainerId, gain] = [...gains.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  const gainer = gainerId ? standings.find((entry) => entry.userId === gainerId) : undefined;

  return {
    champions,
    podium: standings.slice(0, 3),
    undefeated: champions.length === 1 && leader.losses === 0 && leader.wins > 0,
    totals: { players: standings.length, games: games.length, points: games.reduce((total, game) => total + game.winnerScore + game.loserScore, 0) },
    biggestWin,
    // With a single game the closest game is the biggest win too -- don't repeat it.
    closestGame: closestGame && closestGame !== biggestWin ? closestGame : null,
    shutouts: games.filter((game) => game.loserScore === 0).length,
    topScorer: scorer ? { userId: scorer.userId, name: scorer.name, value: scorer.scored } : null,
    biggestRatingGain: gainer && gain > 0 ? { userId: gainer.userId, name: gainer.name, value: Math.round(gain * 100) / 100 } : null,
  };
}

/** Plain-text recap for WhatsApp / group chats. */
export function recapShareText(name: string, recap: Recap, url: string) {
  const lines = [`🏆 ${name} recap`];
  lines.push(`Champion${recap.champions.length > 1 ? "s" : ""}: ${recap.champions.map((entry) => `${entry.name} (${entry.wins}-${entry.losses})`).join(", ")}${recap.undefeated ? " -- undefeated!" : ""}`);
  recap.podium.forEach((entry) => lines.push(`${entry.rank}. ${entry.name} ${entry.wins}-${entry.losses} (${entry.differential > 0 ? "+" : ""}${entry.differential})`));
  if (recap.biggestWin) lines.push(`Biggest win: ${names(recap.biggestWin.winners)} ${recap.biggestWin.winnerScore}-${recap.biggestWin.loserScore}`);
  if (recap.closestGame) lines.push(`Closest game: ${names(recap.closestGame.winners)} ${recap.closestGame.winnerScore}-${recap.closestGame.loserScore}`);
  if (recap.biggestRatingGain) lines.push(`Biggest rating jump: ${recap.biggestRatingGain.name} +${recap.biggestRatingGain.value.toFixed(2)}`);
  lines.push(`${recap.totals.players} players · ${recap.totals.games} games · ${recap.totals.points} points`);
  lines.push(url);
  return lines.join("\n");
}
