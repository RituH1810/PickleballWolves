/** Game counts this far apart (or more) between the busiest player and anyone else count as uneven. */
export const UNEVEN_GAP = 2;

/**
 * How evenly a round robin's games are spread: the most and fewest games played and who's behind
 * (UNEVEN_GAP or more games fewer than the busiest player), fewest first. Players who joined but
 * haven't played yet count as 0.
 */
export function gameBalance(players: { userId: string; name: string; games: number }[]) {
  if (!players.length) return { most: 0, fewest: 0, uneven: false, behind: [] as { userId: string; name: string; games: number }[] };
  const most = Math.max(...players.map((player) => player.games));
  const fewest = Math.min(...players.map((player) => player.games));
  const behind = players.filter((player) => most - player.games >= UNEVEN_GAP).sort((a, b) => a.games - b.games || a.name.localeCompare(b.name));
  return { most, fewest, uneven: most - fewest >= UNEVEN_GAP, behind };
}

/** For an odd number of singles players or fixed teams: who sits out this round -- whoever has played the most, ties at random. */
export function pickByeUnit<T>(units: T[], gamesOf: (unit: T) => number, random = Math.random): T | null {
  if (units.length % 2 === 0) return null;
  const most = Math.max(...units.map(gamesOf));
  const busiest = units.filter((unit) => gamesOf(unit) === most);
  return busiest[Math.floor(random() * busiest.length)];
}
