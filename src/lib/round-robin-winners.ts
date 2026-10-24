/** How many places the group's round robin winners board shows (more when players tie for the last place). */
export const TOP_WINNER_PLACES = 3;

export type RoundRobinWinner = { userId: string; name: string; titles: number; lastWonAt: Date; rank: number };

/**
 * The players who have won the most of a group's round robins (co-champions each get the title),
 * ranked by titles with ties sharing a place, the most recent winner listed first among them.
 */
export function rankRoundRobinWinners(roundRobins: { endedAt: Date; champions: { userId: string; name: string }[] }[]): RoundRobinWinner[] {
  const tally = new Map<string, { userId: string; name: string; titles: number; lastWonAt: Date }>();
  for (const { endedAt, champions } of roundRobins) {
    for (const champion of champions) {
      const entry = tally.get(champion.userId) ?? { userId: champion.userId, name: champion.name, titles: 0, lastWonAt: endedAt };
      entry.titles += 1;
      if (endedAt > entry.lastWonAt) entry.lastWonAt = endedAt;
      tally.set(champion.userId, entry);
    }
  }
  const sorted = [...tally.values()].sort((a, b) => b.titles - a.titles || b.lastWonAt.getTime() - a.lastWonAt.getTime());
  return sorted
    .map((entry) => ({ ...entry, rank: 1 + sorted.filter((other) => other.titles > entry.titles).length }))
    .filter((entry) => entry.rank <= TOP_WINNER_PLACES);
}
