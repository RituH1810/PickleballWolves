import { zonedParts, zonedTimeToUtc } from "./recurring";

// Same calendar as monthly awards: months follow the groups' local time, not UTC.
export const LEADERBOARD_TIME_ZONE = "America/New_York";
/** Matches needed in a month to be ranked (the all-time board needs 20; a month is shorter). */
export const MONTHLY_MIN_MATCHES = 8;
/** How many months players can look back on: this month plus the previous two. */
export const MONTHS_SHOWN = 3;

export type MonthWindow = { key: string; label: string; start: Date; end: Date; isCurrent: boolean };

/** This month and the ones before it, newest first, as UTC instants of their local boundaries. */
export function recentMonths(now = new Date(), count = MONTHS_SHOWN, timeZone = LEADERBOARD_TIME_ZONE): MonthWindow[] {
  const local = zonedParts(now, timeZone);
  return Array.from({ length: count }, (_, back) => {
    const index = local.year * 12 + (local.month - 1) - back;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    const next = index + 1;
    return {
      key: `${year}-${String(month).padStart(2, "0")}`,
      label: new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      start: zonedTimeToUtc(year, month, 1, 0, 0, timeZone),
      end: zonedTimeToUtc(Math.floor(next / 12), (next % 12) + 1, 1, 0, 0, timeZone),
      isCurrent: back === 0,
    };
  });
}

/** One month by its key ("2026-10"), or null for a malformed key or a month that hasn't started. */
export function monthWindow(key: string, now = new Date(), timeZone = LEADERBOARD_TIME_ZONE): MonthWindow | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const local = zonedParts(now, timeZone);
  const back = local.year * 12 + (local.month - 1) - (year * 12 + month - 1);
  if (back < 0) return null;
  return recentMonths(now, back + 1, timeZone)[back];
}

export type LeaderboardMatch = { playedAt: Date; players: { userId: string; side: "A" | "B" }[]; scores: { sideAScore: number; sideBScore: number }[] };
export type MonthlyEntry = { userId: string; matches: number; wins: number; losses: number; scored: number; conceded: number; differential: number; winPct: number; avgPointDiff: number };

/**
 * One month's standings, the group-leaderboard way: a match is won on total points, players are
 * ranked by win %, then average point differential per match. Players below `minMatches` are
 * returned separately (most matches first) instead of being ranked.
 */
export function computeMonthlyLeaderboard(matches: LeaderboardMatch[], playerIds: Set<string>, minMatches = MONTHLY_MIN_MATCHES) {
  const totals = new Map<string, { matches: number; wins: number; scored: number; conceded: number }>();
  for (const match of matches) {
    for (const player of match.players) {
      if (!playerIds.has(player.userId)) continue;
      const mine = match.scores.reduce((total, score) => total + (player.side === "A" ? score.sideAScore : score.sideBScore), 0);
      const theirs = match.scores.reduce((total, score) => total + (player.side === "A" ? score.sideBScore : score.sideAScore), 0);
      const entry = totals.get(player.userId) ?? { matches: 0, wins: 0, scored: 0, conceded: 0 };
      entry.matches += 1;
      entry.scored += mine;
      entry.conceded += theirs;
      if (mine > theirs) entry.wins += 1;
      totals.set(player.userId, entry);
    }
  }
  const entries: MonthlyEntry[] = [...totals].map(([userId, entry]) => {
    const differential = entry.scored - entry.conceded;
    return { userId, ...entry, losses: entry.matches - entry.wins, differential, winPct: entry.wins / entry.matches, avgPointDiff: Math.round((differential / entry.matches) * 10) / 10 };
  });
  const ranked = entries.filter((entry) => entry.matches >= minMatches)
    .sort((a, b) => b.winPct - a.winPct || b.avgPointDiff - a.avgPointDiff || b.matches - a.matches)
    .map((entry, index) => ({ rank: index + 1, ...entry }));
  const unranked = entries.filter((entry) => entry.matches < minMatches).sort((a, b) => b.matches - a.matches || b.winPct - a.winPct);
  return { ranked, unranked };
}

/** Which month a match belongs to (by when it was scored), or null if outside the windows. */
export function monthOf(playedAt: Date, months: MonthWindow[]) {
  return months.find((month) => playedAt >= month.start && playedAt < month.end)?.key ?? null;
}
