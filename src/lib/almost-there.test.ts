import { describe, expect, it } from "vitest";
import type { Achievement } from "./achievements";
import { almostThere, type AlmostThereInput } from "./almost-there";

const badge = (id: string, name: string, current: number, target: number, unlocked = false): Achievement => ({ id, name, description: `${name} description`, icon: "star", tier: "silver", unlocked, unlockedAt: null, progress: { current, target } });
const base: AlmostThereInput = { userId: "me", rating: 2.6, matches: 3, currentStreak: 0, bestStreak: 0, achievements: [], monthly: [] };

describe("almostThere", () => {
  it("lists the closest goals first, at most three", () => {
    const goals = almostThere({
      ...base,
      rating: 2.979,
      matches: 47,
      currentStreak: 4,
      bestStreak: 6,
      achievements: [badge("on-fire", "On Fire", 6, 5), badge("pack-leader", "Pack Leader", 20, 25), badge("mixer", "Mixer", 2, 10)],
      monthly: [{ groupId: "g", groupName: "Lancaster", matches: 18, minMatches: 20 }],
    });
    expect(goals.map((goal) => goal.label)).toEqual(["0.021 to a 3.0 rating", "2 matches to rank on Lancaster's monthly board", "3 matches to your 50th"]);
  });

  it("counts streak badges from the current run", () => {
    const goals = almostThere({ ...base, currentStreak: 4, bestStreak: 4, achievements: [badge("on-fire", "On Fire", 4, 5)] });
    expect(goals[0]).toMatchObject({ id: "badge:on-fire", label: "1 more to unlock On Fire" });
  });

  it("leaves out goals that are far off, done, or yes/no badges", () => {
    const goals = almostThere({ ...base, rating: 2.6, matches: 11, achievements: [badge("bagel", "Bagel", 0, 1), badge("regular", "Regular", 10, 10, true), badge("mixer", "Mixer", 1, 10)] });
    expect(goals).toEqual([]);
  });
});
