import { winningSide } from "./achievements";

/** How far back "on this day" looks, in months. */
export const ON_THIS_DAY_MONTHS = 24;

export type MemoryMatch = { id: string; playedAt: Date; winnerSide: "A" | "B" | null; event: { id: string; name: string } | null; players: { userId: string; side: "A" | "B" }[]; scores: { gameNumber: number; sideAScore: number; sideBScore: number }[] };
export type MemoryTitle = { roundRobinId: string; name: string; endedAt: Date };
export type Memory = { when: string; text: string; href: string | null };

/** YYYY-MM-DD for a moment, on the given time zone's calendar. */
export const dayKey = (date: Date, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

/** The same calendar day 1..ON_THIS_DAY_MONTHS months back (months without that day are skipped), newest first. */
export function pastDays(today: string) {
  const [year, month, day] = today.split("-").map(Number);
  const days: { key: string; monthsAgo: number }[] = [];
  for (let back = 1; back <= ON_THIS_DAY_MONTHS; back++) {
    const total = year * 12 + (month - 1) - back;
    const y = Math.floor(total / 12);
    const m = (total % 12) + 1;
    if (day > new Date(Date.UTC(y, m, 0)).getUTCDate()) continue;
    days.push({ key: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`, monthsAgo: back });
  }
  return days;
}

const ago = (months: number) => (months === 12 ? "A year ago today" : months === 24 ? "Two years ago today" : months === 1 ? "A month ago today" : `${months} months ago today`);

/**
 * One memory from this calendar day in an earlier month: a title won, else the first match ever,
 * else a winning night. The most recent month with something wins, except that a year ago beats all.
 */
export function onThisDay({ today, timeZone, userId, matches, titles }: { today: string; timeZone: string; userId: string; matches: MemoryMatch[]; titles: MemoryTitle[] }): Memory | null {
  const first = [...matches].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime())[0];
  const candidates: (Memory & { rank: number; monthsAgo: number })[] = [];
  for (const { key, monthsAgo } of pastDays(today)) {
    const when = ago(monthsAgo);
    const yearly = monthsAgo % 12 === 0 ? 10 : 0;
    const won = titles.filter((title) => dayKey(title.endedAt, timeZone) === key);
    if (won.length) {
      candidates.push({ when, text: `You won ${won[0].name}${won.length > 1 ? ` and ${won.length - 1} more` : ""} 👑`, href: `/round-robin/${won[0].roundRobinId}`, rank: 3 + yearly, monthsAgo });
      continue;
    }
    if (first && dayKey(first.playedAt, timeZone) === key) {
      candidates.push({ when, text: `You played your first match${first.event ? ` at ${first.event.name}` : ""} 🎉`, href: first.event ? `/round-robin/${first.event.id}` : null, rank: 2 + yearly, monthsAgo });
      continue;
    }
    let wins = 0;
    let losses = 0;
    const events = new Map<string, { id: string; name: string; count: number }>();
    for (const match of matches.filter((entry) => dayKey(entry.playedAt, timeZone) === key)) {
      const side = match.players.find((player) => player.userId === userId)?.side;
      const winner = winningSide(match);
      if (!side || !winner) continue;
      if (winner === side) wins += 1; else losses += 1;
      if (match.event) events.set(match.event.id, { ...match.event, count: (events.get(match.event.id)?.count ?? 0) + 1 });
    }
    if (wins > losses) {
      const event = [...events.values()].sort((a, b) => b.count - a.count)[0];
      candidates.push({ when, text: `You went ${wins}-${losses}${event ? ` at ${event.name}` : ""} 🔥`, href: event ? `/round-robin/${event.id}` : null, rank: 1 + yearly, monthsAgo });
    }
  }
  const best = candidates.sort((a, b) => b.rank - a.rank || a.monthsAgo - b.monthsAgo)[0];
  return best ? { when: best.when, text: best.text, href: best.href } : null;
}
