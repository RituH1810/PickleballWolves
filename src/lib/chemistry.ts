import { DUO_MIN_GAMES, groupGames, type HallOfFameRoundRobin } from "./hall-of-fame";

/** Most players the grid shows (the ones with the most doubles games). */
export const CHEMISTRY_MAX_PLAYERS = 16;

export type ChemistryPlayer = { userId: string; name: string; games: number };
export type ChemistryPair = { a: string; b: string; wins: number; losses: number };
export type Chemistry = { players: ChemistryPlayer[]; pairs: ChemistryPair[]; best: ChemistryPair[]; worst: ChemistryPair | null };

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const rate = (pair: ChemistryPair) => pair.wins / (pair.wins + pair.losses);

/**
 * Every doubles pair's record together in a group's ended round robins, game by game like the Hall
 * of Fame (tied games are skipped). Guests are left out of the grid. `best` is the top 3 winning pairs and
 * `worst` the weakest, among pairs with DUO_MIN_GAMES+ games together.
 */
export function computeChemistry(roundRobins: HallOfFameRoundRobin[], guestIds = new Set<string>()): Chemistry {
  const pairs = new Map<string, ChemistryPair>();
  const players = new Map<string, ChemistryPlayer>();
  for (const game of groupGames(roundRobins)) {
    for (const [team, won] of [[game.winners, true], [game.losers, false]] as const) {
      if (team.length !== 2 || team.some((player) => guestIds.has(player.userId))) continue;
      const [first, second] = [...team].sort((x, y) => x.userId.localeCompare(y.userId));
      const key = pairKey(first.userId, second.userId);
      const pair = pairs.get(key) ?? { a: first.userId, b: second.userId, wins: 0, losses: 0 };
      if (won) pair.wins += 1; else pair.losses += 1;
      pairs.set(key, pair);
      for (const player of team) {
        const entry = players.get(player.userId) ?? { userId: player.userId, name: player.name, games: 0 };
        entry.games += 1;
        players.set(player.userId, entry);
      }
    }
  }
  const shown = [...players.values()].sort((x, y) => y.games - x.games || x.name.localeCompare(y.name)).slice(0, CHEMISTRY_MAX_PLAYERS);
  const shownIds = new Set(shown.map((player) => player.userId));
  const shownPairs = [...pairs.values()].filter((pair) => shownIds.has(pair.a) && shownIds.has(pair.b));
  const qualified = shownPairs.filter((pair) => pair.wins + pair.losses >= DUO_MIN_GAMES);
  const ranked = [...qualified].sort((x, y) => rate(y) - rate(x) || y.wins + y.losses - (x.wins + x.losses));
  const worst = [...qualified].sort((x, y) => rate(x) - rate(y) || y.wins + y.losses - (x.wins + x.losses))[0] ?? null;
  return { players: shown, pairs: shownPairs, best: ranked.filter((pair) => rate(pair) > 0.5).slice(0, 3), worst: worst && rate(worst) < 0.5 ? worst : null };
}
