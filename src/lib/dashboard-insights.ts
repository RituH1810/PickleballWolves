// Small calculations behind the dashboard's "Your week", "Rival watch" and "Group pulse" cards.

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Net rating change over the last `days` days. */
export function recentRatingChange(rows: { ratingDelta: number; createdAt: Date }[], now: Date, days = 7) {
  const since = now.getTime() - days * 86_400_000;
  return round3(rows.filter((row) => row.createdAt.getTime() >= since).reduce((total, row) => total + row.ratingDelta, 0));
}

/** "today", "tomorrow", "in 3 days", or "in 2 hours" when it's within the next half day. */
export function countdown(at: Date, now: Date) {
  const hours = (at.getTime() - now.getTime()) / 3_600_000;
  if (hours <= 0) return "now";
  if (hours < 12) return hours < 1 ? "within the hour" : `in ${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"}`;
  const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((midnight(at) - midnight(now)) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
}

type Rated = { userId: string; name: string; rating: number };

/** Where the player sits by rating among `players`: their place, and the nearest player above and below with the gap. */
export function ratingNeighbors(players: Rated[], userId: string) {
  const sorted = [...players].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  const index = sorted.findIndex((player) => player.userId === userId);
  if (index < 0) return null;
  const me = sorted[index];
  const above = index > 0 ? sorted[index - 1] : null;
  const below = index < sorted.length - 1 ? sorted[index + 1] : null;
  return {
    place: index + 1,
    of: sorted.length,
    above: above && { name: above.name, userId: above.userId, gap: round3(above.rating - me.rating) },
    below: below && { name: below.name, userId: below.userId, gap: round3(me.rating - below.rating) },
  };
}

/** The player's place on a ranked monthly board and who's one spot ahead (null if they aren't ranked). */
export function monthlyPosition(ranked: { userId: string; rank: number; winPct: number }[], userId: string) {
  const mine = ranked.find((entry) => entry.userId === userId);
  if (!mine) return null;
  const ahead = ranked.find((entry) => entry.rank === mine.rank - 1) ?? null;
  return { rank: mine.rank, of: ranked.length, winPct: mine.winPct, ahead: ahead && { userId: ahead.userId, winPct: ahead.winPct } };
}

/** The newest `limit` items across several groups' feeds, each tagged with its group. */
export function mergePulse<T extends { at: Date }>(feeds: { groupId: string; groupName: string; items: T[] }[], limit = 3) {
  return feeds
    .flatMap((feed) => feed.items.map((item) => ({ ...item, groupId: feed.groupId, groupName: feed.groupName })))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}
