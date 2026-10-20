import { computeMonthlyLeaderboard, LEADERBOARD_TIME_ZONE, type LeaderboardMatch } from "./monthly-leaderboard";
import { zonedParts, zonedTimeToUtc } from "./recurring";

/** Matches needed in a week to be eligible. */
export const WEEKLY_MIN_MATCHES = 5;

export type Week = { start: Date; end: Date; label: string };

/** "Oct 12 - Oct 18" for the week starting at `start` (a local Monday). */
export function weekLabel(start: Date, timeZone = LEADERBOARD_TIME_ZONE) {
  const format = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
  return `${format(start)} - ${format(new Date(start.getTime() + 6 * 86_400_000 + 12 * 3_600_000))}`;
}

/**
 * The Monday-to-Sunday week that most recently finished, in local time: on any day this week it's
 * last week. Boundaries are local midnights, so they shift correctly across daylight saving.
 */
export function previousWeek(now = new Date(), timeZone = LEADERBOARD_TIME_ZONE): Week {
  const local = zonedParts(now, timeZone);
  const today = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const sinceMonday = (today.getUTCDay() + 6) % 7;
  const thisMonday = new Date(today.getTime() - sinceMonday * 86_400_000);
  const lastMonday = new Date(thisMonday.getTime() - 7 * 86_400_000);
  const at = (day: Date) => zonedTimeToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), 0, 0, timeZone);
  const start = at(lastMonday);
  return { start, end: at(thisMonday), label: weekLabel(start, timeZone) };
}

/**
 * The week's best member(s) -- ranked like the leaderboards (win %, then average point difference),
 * among those with at least WEEKLY_MIN_MATCHES matches. Ties on both share it; nobody qualifies -> [].
 */
export function pickPlayerOfTheWeek(matches: LeaderboardMatch[], memberIds: Set<string>, minMatches = WEEKLY_MIN_MATCHES) {
  const { ranked } = computeMonthlyLeaderboard(matches, memberIds, minMatches);
  const top = ranked[0];
  if (!top) return [];
  return ranked.filter((entry) => entry.winPct === top.winPct && entry.avgPointDiff === top.avgPointDiff);
}
