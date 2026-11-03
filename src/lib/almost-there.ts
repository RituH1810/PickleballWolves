import type { Achievement } from "./achievements";
import { RATING_MILESTONES } from "./group-feed";

/** Career match milestones. */
export const MATCH_MILESTONES = [10, 25, 50, 100, 200, 300, 400, 500, 750, 1000];
/** Goals shown at most, closest first. */
export const ALMOST_THERE_LIMIT = 3;
/** How far along a goal must be (0-1) to make the card. */
export const ALMOST_THERE_MIN_PROGRESS = 0.4;
const STREAK_BADGES = new Set(["hot-hand", "on-fire", "unstoppable"]);

export type Goal = { id: string; label: string; detail: string; progress: number; href: string | null };
export type AlmostThereInput = {
  userId: string;
  rating: number;
  matches: number;
  currentStreak: number;
  bestStreak: number;
  achievements: Achievement[];
  /** This month's matches in each group, for qualifying on its monthly leaderboard. */
  monthly: { groupId: string; groupName: string; matches: number; minMatches: number }[];
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : word.endsWith("ch") ? "es" : "s"}`;
const ordinal = (value: number) => `${value}${value % 100 >= 11 && value % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][value % 10] ?? "th"}`;

/**
 * The player's nearest goals, closest first: the next rating milestone, the next career match
 * milestone, tying their best win streak, badges they're partway to, and qualifying for a group's
 * monthly leaderboard. Only goals at least ALMOST_THERE_MIN_PROGRESS of the way there count.
 */
export function almostThere(input: AlmostThereInput): Goal[] {
  const goals: Goal[] = [];
  const profile = `/players/${input.userId}`;

  const nextRating = RATING_MILESTONES.find((milestone) => milestone > input.rating);
  if (nextRating !== undefined) {
    const gap = Math.round((nextRating - input.rating) * 1000) / 1000;
    goals.push({ id: `rating:${nextRating}`, label: `${gap.toFixed(3)} to a ${nextRating.toFixed(1)} rating`, detail: `You're at ${input.rating.toFixed(3)}`, progress: 1 - gap / 0.5, href: profile });
  }

  const nextMatches = MATCH_MILESTONES.find((milestone) => milestone > input.matches);
  if (nextMatches !== undefined) {
    const previous = [...MATCH_MILESTONES].reverse().find((milestone) => milestone <= input.matches) ?? 0;
    goals.push({ id: `matches:${nextMatches}`, label: `${plural(nextMatches - input.matches, "match")} to your ${ordinal(nextMatches)}`, detail: `${input.matches} played so far`, progress: (input.matches - previous) / (nextMatches - previous), href: "/matches" });
  }

  if (input.currentStreak > 0 && input.bestStreak > input.currentStreak) {
    const needed = input.bestStreak - input.currentStreak;
    goals.push({ id: "streak", label: `${plural(needed, "more win")} ties your best streak`, detail: `On ${input.currentStreak} in a row · best is ${input.bestStreak}`, progress: input.currentStreak / input.bestStreak, href: profile });
  }

  for (const badge of input.achievements) {
    if (badge.unlocked || badge.progress.target <= 1) continue;
    // Streak badges count the run you're on now, not your best ever.
    const current = STREAK_BADGES.has(badge.id) ? input.currentStreak : badge.progress.current;
    if (current <= 0) continue;
    const remaining = badge.progress.target - current;
    if (remaining <= 0) continue;
    const label = badge.id === "rising-star" ? `+${remaining.toFixed(3)} rating to unlock ${badge.name}` : `${remaining} more to unlock ${badge.name}`;
    goals.push({ id: `badge:${badge.id}`, label, detail: badge.description, progress: current / badge.progress.target, href: profile });
  }

  for (const group of input.monthly) {
    if (group.matches <= 0 || group.matches >= group.minMatches) continue;
    goals.push({ id: `monthly:${group.groupId}`, label: `${plural(group.minMatches - group.matches, "match")} to rank on ${group.groupName}'s monthly board`, detail: `${group.matches} of ${group.minMatches} this month`, progress: group.matches / group.minMatches, href: `/groups/${group.groupId}#monthly-leaderboard` });
  }

  return goals.filter((goal) => goal.progress >= ALMOST_THERE_MIN_PROGRESS && goal.progress < 1).sort((a, b) => b.progress - a.progress).slice(0, ALMOST_THERE_LIMIT);
}
