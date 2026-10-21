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

type Pairing = PlayerRef & { wins: number; losses: number };

export type PlayerRecap = {
  rank: number;
  tiedWith: number;
  players: number;
  champion: boolean;
  wins: number;
  losses: number;
  scored: number;
  conceded: number;
  differential: number;
  winPct: number;
  ratingChange: number | null;
  bestPartner: Pairing | null;
  toughestOpponent: Pairing | null;
  bestWin: GameHighlight | null;
  closestGame: (GameHighlight & { won: boolean }) | null;
};

export function ordinal(n: number) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** One player's night: where they finished, how they played, and who with/against. */
export function computePlayerRecap(matches: RecapMatch[], userId: string, ratingDeltas: { userId: string; matchId: string | null; ratingDelta: number }[] = []): PlayerRecap | null {
  const scored = matches.filter((match) => match.scores.length > 0 && match.players.some((player) => player.userId === userId));
  if (!scored.length) return null;
  const standings = computeRoundRobinStandings(matches.filter((match) => match.scores.length > 0));
  const mine = standings.find((entry) => entry.userId === userId)!;
  // Players level on wins and differential share a place, same as the recap's co-champions.
  const rank = standings.findIndex((entry) => entry.wins === mine.wins && entry.differential === mine.differential) + 1;
  const tiedWith = standings.filter((entry) => entry.userId !== userId && entry.wins === mine.wins && entry.differential === mine.differential).length;

  const partners = new Map<string, Pairing>();
  const opponents = new Map<string, Pairing>();
  const games: (GameHighlight & { won: boolean })[] = [];
  const tally = (map: Map<string, Pairing>, player: PlayerRef, won: boolean) => {
    const entry = map.get(player.userId) ?? { userId: player.userId, name: player.name, wins: 0, losses: 0 };
    if (won) entry.wins += 1; else entry.losses += 1;
    map.set(player.userId, entry);
  };
  for (const match of scored) {
    const side = match.players.find((player) => player.userId === userId)!.side;
    const team = match.players.filter((player) => player.side === side && player.userId !== userId);
    const others = match.players.filter((player) => player.side !== side);
    for (const score of match.scores) {
      const own = side === "A" ? score.sideAScore : score.sideBScore;
      const other = side === "A" ? score.sideBScore : score.sideAScore;
      if (own === other) continue;
      const won = own > other;
      team.forEach((player) => tally(partners, player, won));
      others.forEach((player) => tally(opponents, player, won));
      const us = match.players.filter((player) => player.side === side).map(({ userId: id, name }) => ({ userId: id, name }));
      const them = others.map(({ userId: id, name }) => ({ userId: id, name }));
      games.push({ matchId: match.id, won, winners: won ? us : them, losers: won ? them : us, winnerScore: Math.max(own, other), loserScore: Math.min(own, other) });
    }
  }

  // Best partner: most wins together (then fewest losses); toughest opponent: most losses to them.
  const bestPartner = [...partners.values()].sort((a, b) => b.wins - a.wins || a.losses - b.losses)[0] ?? null;
  const toughestOpponent = [...opponents.values()].filter((entry) => entry.losses > 0).sort((a, b) => b.losses - a.losses || a.wins - b.wins)[0] ?? null;
  const margin = (game: GameHighlight) => game.winnerScore - game.loserScore;
  const bestWin = games.filter((game) => game.won).sort((a, b) => margin(b) - margin(a))[0] ?? null;
  const closestGame = [...games].sort((a, b) => margin(a) - margin(b) || b.winnerScore - a.winnerScore)[0] ?? null;

  const matchIds = new Set(scored.map((match) => match.id));
  const myDeltas = ratingDeltas.filter((row) => row.userId === userId && row.matchId && matchIds.has(row.matchId));
  const ratingChange = myDeltas.length ? Math.round(myDeltas.reduce((total, row) => total + row.ratingDelta, 0) * 100) / 100 : null;

  return {
    rank,
    tiedWith,
    players: standings.length,
    champion: rank === 1,
    wins: mine.wins,
    losses: mine.losses,
    scored: mine.scored,
    conceded: mine.conceded,
    differential: mine.differential,
    winPct: mine.winPct,
    ratingChange,
    bestPartner: bestPartner && bestPartner.wins > 0 ? bestPartner : null,
    toughestOpponent,
    bestWin,
    closestGame: closestGame && closestGame !== bestWin ? closestGame : null,
  };
}

/** "You finished 2nd of 7 · 5-3 · +8 points · rating +0.12" */
export function playerRecapHeadline(recap: PlayerRecap) {
  const place = recap.champion ? `You won${recap.tiedWith ? ` (tied with ${recap.tiedWith})` : ""}` : `You finished ${recap.tiedWith ? "tied " : ""}${ordinal(recap.rank)} of ${recap.players}`;
  const rating = recap.ratingChange !== null && recap.ratingChange !== 0 ? ` · rating ${recap.ratingChange > 0 ? "+" : "−"}${Math.abs(recap.ratingChange).toFixed(2)}` : "";
  return `${place} · ${recap.wins}-${recap.losses} · ${recap.differential > 0 ? "+" : ""}${recap.differential} points${rating}`;
}
