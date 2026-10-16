import type { RecapMatch } from "@/lib/round-robin-recap";

export type AwardKind = "MOST_IMPROVED" | "IRON_WOLF" | "BEST_PARTNERSHIP";
export type Award = { award: AwardKind; userId: string; name: string; partnerId: string | null; partnerName: string | null; value: number; detail: string };

export const AWARD_LABELS: Record<AwardKind, { title: string; blurb: string }> = {
  IRON_WOLF: { title: "Iron Wolf", blurb: "Most games played" },
  MOST_IMPROVED: { title: "Most Improved", blurb: "Biggest rating gain" },
  BEST_PARTNERSHIP: { title: "Best Partnership", blurb: "Best record as partners" },
};

// Small samples make for silly winners, so each award needs a minimum.
export const MOST_IMPROVED_MIN_GAMES = 5;
export const PARTNERSHIP_MIN_GAMES = 4;

/**
 * A group's awards for one month, from that month's scored games in the group. Ties share an
 * award. Returns nothing for an award nobody qualifies for.
 */
export function computeMonthlyAwards(matches: RecapMatch[], ratingDeltas: { userId: string; matchId: string | null; ratingDelta: number }[]): Award[] {
  const names = new Map<string, string>();
  const games = new Map<string, number>();
  const pairs = new Map<string, { a: string; b: string; wins: number; losses: number }>();
  for (const match of matches) {
    for (const player of match.players) names.set(player.userId, player.name);
    for (const score of match.scores) {
      if (score.sideAScore === score.sideBScore) continue;
      for (const player of match.players) games.set(player.userId, (games.get(player.userId) ?? 0) + 1);
      for (const side of ["A", "B"] as const) {
        const team = match.players.filter((player) => player.side === side).map((player) => player.userId).sort();
        if (team.length !== 2) continue;
        const key = team.join("|");
        const entry = pairs.get(key) ?? { a: team[0], b: team[1], wins: 0, losses: 0 };
        if ((side === "A") === (score.sideAScore > score.sideBScore)) entry.wins += 1; else entry.losses += 1;
        pairs.set(key, entry);
      }
    }
  }
  const awards: Award[] = [];
  const name = (userId: string) => names.get(userId) ?? "Player";

  const mostGames = Math.max(0, ...games.values());
  if (mostGames > 0) {
    for (const [userId, count] of games) if (count === mostGames) awards.push({ award: "IRON_WOLF", userId, name: name(userId), partnerId: null, partnerName: null, value: count, detail: `${count} games played` });
  }

  const matchIds = new Set(matches.map((match) => match.id));
  const gains = new Map<string, number>();
  for (const row of ratingDeltas) if (row.matchId && matchIds.has(row.matchId)) gains.set(row.userId, (gains.get(row.userId) ?? 0) + row.ratingDelta);
  const eligibleGains = [...gains].filter(([userId, gain]) => (games.get(userId) ?? 0) >= MOST_IMPROVED_MIN_GAMES && gain > 0).map(([userId, gain]) => [userId, Math.round(gain * 100) / 100] as const);
  const bestGain = Math.max(0, ...eligibleGains.map(([, gain]) => gain));
  for (const [userId, gain] of eligibleGains) if (gain === bestGain) awards.push({ award: "MOST_IMPROVED", userId, name: name(userId), partnerId: null, partnerName: null, value: gain, detail: `+${gain.toFixed(2)} rating` });

  const eligiblePairs = [...pairs.values()].filter((pair) => pair.wins + pair.losses >= PARTNERSHIP_MIN_GAMES && pair.wins > 0);
  const pct = (pair: { wins: number; losses: number }) => pair.wins / (pair.wins + pair.losses);
  const best = [...eligiblePairs].sort((x, y) => pct(y) - pct(x) || y.wins - x.wins)[0];
  if (best) {
    for (const pair of eligiblePairs.filter((entry) => pct(entry) === pct(best) && entry.wins === best.wins)) {
      const detail = `${pair.wins}-${pair.losses} together`;
      awards.push({ award: "BEST_PARTNERSHIP", userId: pair.a, name: name(pair.a), partnerId: pair.b, partnerName: name(pair.b), value: pct(pair), detail });
      awards.push({ award: "BEST_PARTNERSHIP", userId: pair.b, name: name(pair.b), partnerId: pair.a, partnerName: name(pair.a), value: pct(pair), detail });
    }
  }
  return awards;
}

/** "2026-10" -> "October 2026" */
export function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 15)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** The announcement posted to the group. Partnerships appear once, not once per partner. */
export function awardsAnnouncement(month: string, awards: Award[]) {
  const lines: string[] = [];
  for (const kind of ["IRON_WOLF", "MOST_IMPROVED", "BEST_PARTNERSHIP"] as AwardKind[]) {
    const winners = awards.filter((award) => award.award === kind);
    if (!winners.length) continue;
    const seen = new Set<string>();
    const who = winners.flatMap((award) => {
      if (award.partnerId) {
        const key = [award.userId, award.partnerId].sort().join("|");
        if (seen.has(key)) return [];
        seen.add(key);
        return [`${award.name} & ${award.partnerName} (${award.detail})`];
      }
      return [`${award.name} (${award.detail})`];
    });
    lines.push(`${AWARD_LABELS[kind].title}: ${who.join(", ")}`);
  }
  return { title: `${monthLabel(month)} awards`, body: `${lines.join("\n")}\n\nCongrats! Awards are on each winner's profile.` };
}
