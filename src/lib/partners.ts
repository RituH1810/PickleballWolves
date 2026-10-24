import { sideTotals, type RivalryMatch } from "./rivalry";

/** Fewest matches together before a partner can be your best partner. */
export const PARTNER_MIN_MATCHES = 3;

export type Partnership = { userId: string; name: string; wins: number; losses: number; played: number; winRate: number; pointDiff: number };

/**
 * Everyone a player has partnered on scored matches (tied totals are skipped), most-played first,
 * plus their best partner: the highest win rate over at least PARTNER_MIN_MATCHES matches, ties
 * going to more matches together and then the bigger point differential.
 */
export function computePartners(matches: RivalryMatch[], userId: string) {
  const together = new Map<string, { name: string; wins: number; losses: number; pointDiff: number }>();
  for (const match of matches) {
    const side = match.players.find((player) => player.userId === userId)?.side;
    if (!side || !match.scores.length) continue;
    const mine = sideTotals(match, side);
    const theirs = sideTotals(match, side === "A" ? "B" : "A");
    if (mine === theirs) continue;
    for (const partner of match.players.filter((player) => player.side === side && player.userId !== userId)) {
      const entry = together.get(partner.userId) ?? { name: partner.name, wins: 0, losses: 0, pointDiff: 0 };
      if (mine > theirs) entry.wins += 1; else entry.losses += 1;
      entry.pointDiff += mine - theirs;
      together.set(partner.userId, entry);
    }
  }

  const partners: Partnership[] = [...together]
    .map(([id, entry]) => ({ userId: id, ...entry, played: entry.wins + entry.losses, winRate: entry.wins / (entry.wins + entry.losses) }))
    .sort((x, y) => y.played - x.played || y.winRate - x.winRate);
  const best = partners
    .filter((partner) => partner.played >= PARTNER_MIN_MATCHES)
    .sort((x, y) => y.winRate - x.winRate || y.played - x.played || y.pointDiff - x.pointDiff)[0] ?? null;
  return { best, partners };
}
