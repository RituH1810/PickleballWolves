// XP and player levels: points for showing up and taking part, not just winning, worked out from
// what's already recorded (nothing is stored). See XP_RULES for what earns what.

export const XP_RULES = {
  match: 10, // every scored match played
  win: 5, // on top of the match
  night: 15, // each round robin night you played in
  title: 30, // round robin champion (shared titles count)
  pickle: 10, // each game won 11-0 (or any shutout)
  goodWolfVote: 3, // casting a Good Wolf vote
  goodWolfWin: 25, // voted Good Wolf
  reaction: 1, // reacting to a result, up to REACTION_XP_PER_DAY a day
  badge: { bronze: 20, silver: 40, gold: 75 },
} as const;
export const REACTION_XP_PER_DAY = 5;

/** The titles levels unlock, from the first level up. */
export const LEVEL_TITLES = [
  { from: 1, title: "Pup" },
  { from: 3, title: "Scout" },
  { from: 6, title: "Hunter" },
  { from: 10, title: "Alpha" },
  { from: 15, title: "Legend" },
] as const;

/** Total XP needed to reach `level`: 0, 100, 300, 600, 1000... -- each level takes 100 more than the last. */
export const xpForLevel = (level: number) => (100 * (level - 1) * level) / 2;

/** The level for an XP total, its title, and progress towards the next level. */
export function levelFor(xp: number) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level += 1;
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  const title = [...LEVEL_TITLES].reverse().find((entry) => level >= entry.from)!.title;
  return { level, title, xp, intoLevel: xp - floor, levelSize: ceiling - floor, toNext: ceiling - xp, progress: (xp - floor) / (ceiling - floor) };
}

export type XpInput = {
  matches: number;
  wins: number;
  nights: number;
  titles: number;
  pickles: number;
  goodWolfVotes: number;
  goodWolfWins: number;
  /** When each reaction was given, for the daily cap. */
  reactionsAt: Date[];
  badges: { tier: "bronze" | "silver" | "gold" }[];
};

/** XP by source (biggest first) and the total, with the level it reaches. Reactions count up to REACTION_XP_PER_DAY a day. */
export function computeXp(input: XpInput) {
  const perDay = new Map<string, number>();
  for (const at of input.reactionsAt) perDay.set(at.toISOString().slice(0, 10), (perDay.get(at.toISOString().slice(0, 10)) ?? 0) + 1);
  const reactionXp = [...perDay.values()].reduce((total, count) => total + Math.min(count, REACTION_XP_PER_DAY) * XP_RULES.reaction, 0);
  const badgeXp = input.badges.reduce((total, badge) => total + XP_RULES.badge[badge.tier], 0);
  const sources = [
    { id: "matches", label: "Matches played", count: input.matches, xp: input.matches * XP_RULES.match },
    { id: "wins", label: "Wins", count: input.wins, xp: input.wins * XP_RULES.win },
    { id: "nights", label: "Round robin nights", count: input.nights, xp: input.nights * XP_RULES.night },
    { id: "titles", label: "Round robin titles", count: input.titles, xp: input.titles * XP_RULES.title },
    { id: "badges", label: "Badges", count: input.badges.length, xp: badgeXp },
    { id: "pickles", label: "Pickles (shutout wins)", count: input.pickles, xp: input.pickles * XP_RULES.pickle },
    { id: "goodWolfWins", label: "Good Wolf awards", count: input.goodWolfWins, xp: input.goodWolfWins * XP_RULES.goodWolfWin },
    { id: "goodWolfVotes", label: "Good Wolf votes cast", count: input.goodWolfVotes, xp: input.goodWolfVotes * XP_RULES.goodWolfVote },
    { id: "reactions", label: "Reactions", count: input.reactionsAt.length, xp: reactionXp },
  ].filter((source) => source.xp > 0).sort((a, b) => b.xp - a.xp);
  const total = sources.reduce((sum, source) => sum + source.xp, 0);
  return { total, sources, ...levelFor(total) };
}
