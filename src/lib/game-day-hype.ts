// The morning-of "game day" push for a round robin: one personalized line per player who joined.

/** Local hour (app time zone) from which game-day messages go out. */
export const HYPE_FROM_HOUR = 9;
/** No hype within this long of the start -- the regular reminder covers that. */
export const HYPE_MIN_LEAD_MS = 2 * 60 * 60 * 1000;
/** Career match milestones worth calling out when one could fall tonight. */
const MATCH_MILESTONES = [10, 25, 50, 100, 200, 300, 400, 500, 750, 1000];

export type HypePlayer = { userId: string; name: string; streak: number; matches: number };
export type HypeInput = {
  when: string;
  joined: number;
  me: HypePlayer;
  /** Everyone else who's joined. */
  others: HypePlayer[];
  /** Your record against each of them, by user id. */
  versus: Map<string, { wins: number; losses: number }>;
};

const ordinal = (value: number) => `${value}${value % 100 >= 11 && value % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][value % 10] ?? "th"}`;

/** Title is the same for everyone in a round robin (it's also how a repeat send is spotted). */
export const hypeTitle = (roundRobinName: string) => `Game day: ${roundRobinName} 🏓`;

/**
 * One line for one player: when and how many joined, then up to two hooks, most personal first --
 * their own streak, a milestone they could hit tonight, their closest rivalry among tonight's
 * players, or whoever else is on the hottest streak.
 */
export function hypeBody(input: HypeInput) {
  const hooks: string[] = [];
  if (input.me.streak >= 2) hooks.push(`You're on a ${input.me.streak}-win streak 🔥`);
  const milestone = MATCH_MILESTONES.find((value) => value > input.me.matches);
  if (milestone !== undefined && milestone - input.me.matches <= 2) hooks.push(`your ${ordinal(milestone)} match could be tonight`);

  // Rivalry: the joined player you've faced most (at least 3 times), closest records first on ties.
  const rival = input.others
    .map((other) => ({ other, record: input.versus.get(other.userId) }))
    .filter((entry): entry is { other: HypePlayer; record: { wins: number; losses: number } } => Boolean(entry.record) && entry.record!.wins + entry.record!.losses >= 3)
    .sort((a, b) => (b.record.wins + b.record.losses) - (a.record.wins + a.record.losses) || Math.abs(a.record.wins - a.record.losses) - Math.abs(b.record.wins - b.record.losses))[0];
  if (rival) {
    const { wins, losses } = rival.record;
    hooks.push(wins === losses ? `you and ${rival.other.name} are ${wins}-${losses}, settle it tonight` : wins > losses ? `you lead ${rival.other.name} ${wins}-${losses}` : `${rival.other.name} leads you ${losses}-${wins}, time for payback`);
  }

  const hottest = [...input.others].filter((other) => other.streak >= 3).sort((a, b) => b.streak - a.streak || a.name.localeCompare(b.name))[0];
  if (hottest) hooks.push(`${hottest.name} is on a ${hottest.streak}-win streak`);

  const opener = `${input.when} · ${input.joined} joined`;
  const picked = hooks.slice(0, 2).map((hook, index) => (index === 0 ? hook[0].toUpperCase() + hook.slice(1) : hook));
  return picked.length ? `${opener}. ${picked.join(" · ")}` : `${opener}. See you on the court!`;
}

/**
 * Whether it's time for a round robin's game-day message: it starts later today (app time zone),
 * it's past HYPE_FROM_HOUR, and it's still at least HYPE_MIN_LEAD_MS away.
 */
export function isHypeTime(startsAt: Date, now: Date, timeZone: string) {
  const day = (date: Date) => date.toLocaleDateString("en-CA", { timeZone });
  const hour = Number(now.toLocaleString("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }));
  return day(startsAt) === day(now) && hour >= HYPE_FROM_HOUR && startsAt.getTime() - now.getTime() >= HYPE_MIN_LEAD_MS;
}
