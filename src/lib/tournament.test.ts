import { describe, expect, it } from "vitest";
import {
  assignGroupsRandom,
  assignGroupsSeeded,
  distributeIntoGroups,
  formMixedTeamsBalanced,
  formMixedTeamsRandom,
  formTeamsBalanced,
  formTeamsRandom,
  generatePoolRounds,
  groupCountFromTargetSize,
  skillLevelForRating,
  validateMixedPair,
} from "./tournament";

describe("skillLevelForRating", () => {
  it("classifies beginner below 3.5", () => {
    expect(skillLevelForRating(2.0)).toBe("BEGINNER");
    expect(skillLevelForRating(3.4)).toBe("BEGINNER");
  });
  it("classifies intermediate from 3.5 up to (not including) 4.0", () => {
    expect(skillLevelForRating(3.5)).toBe("INTERMEDIATE");
    expect(skillLevelForRating(3.9)).toBe("INTERMEDIATE");
  });
  it("classifies advanced at 4.0 and above", () => {
    expect(skillLevelForRating(4.0)).toBe("ADVANCED");
    expect(skillLevelForRating(6.0)).toBe("ADVANCED");
  });
});

describe("formTeamsRandom", () => {
  it("pairs everyone with no leftovers when the count is even", () => {
    const { teams, unpaired } = formTeamsRandom(["a", "b", "c", "d"]);
    expect(teams.length).toBe(2);
    expect(unpaired.length).toBe(0);
    expect(new Set(teams.flat())).toEqual(new Set(["a", "b", "c", "d"]));
  });
  it("leaves exactly one player unpaired when the count is odd", () => {
    const { teams, unpaired } = formTeamsRandom(["a", "b", "c"]);
    expect(teams.length).toBe(1);
    expect(unpaired.length).toBe(1);
  });
});

describe("formTeamsBalanced", () => {
  it("pairs strongest with weakest so team totals land close together", () => {
    const entrants = [
      { userId: "a", skillRating: 5.0 },
      { userId: "b", skillRating: 4.0 },
      { userId: "c", skillRating: 3.0 },
      { userId: "d", skillRating: 2.0 },
    ];
    const { teams, unpaired } = formTeamsBalanced(entrants);
    expect(unpaired.length).toBe(0);
    const totals = teams.map(([x, y]) => {
      const ratingOf = (id: string) => entrants.find((entrant) => entrant.userId === id)!.skillRating;
      return ratingOf(x) + ratingOf(y);
    });
    // a+d = 7, b+c = 7 -- perfectly balanced
    expect(totals.every((total) => total === 7)).toBe(true);
  });
  it("leaves one entrant unpaired when the count is odd", () => {
    const { unpaired } = formTeamsBalanced([{ userId: "a", skillRating: 5 }, { userId: "b", skillRating: 4 }, { userId: "c", skillRating: 3 }]);
    expect(unpaired.length).toBe(1);
  });
});

describe("validateMixedPair", () => {
  it("accepts one male and one female", () => {
    expect(validateMixedPair("MALE", "FEMALE").valid).toBe(true);
    expect(validateMixedPair("FEMALE", "MALE").valid).toBe(true);
  });
  it("rejects two of the same gender", () => {
    expect(validateMixedPair("MALE", "MALE").valid).toBe(false);
    expect(validateMixedPair("FEMALE", "FEMALE").valid).toBe(false);
  });
  it("rejects when gender is missing or unspecified", () => {
    expect(validateMixedPair(null, "FEMALE").valid).toBe(false);
    expect(validateMixedPair("UNSPECIFIED", "FEMALE").valid).toBe(false);
  });
});

describe("formMixedTeamsBalanced", () => {
  it("pairs one male with one female per team", () => {
    const entrants = [
      { userId: "m1", skillRating: 5, gender: "MALE" as const },
      { userId: "m2", skillRating: 3, gender: "MALE" as const },
      { userId: "f1", skillRating: 4.5, gender: "FEMALE" as const },
      { userId: "f2", skillRating: 3.5, gender: "FEMALE" as const },
    ];
    const { teams, unpaired } = formMixedTeamsBalanced(entrants);
    expect(teams.length).toBe(2);
    expect(unpaired.length).toBe(0);
    for (const [a, b] of teams) {
      const genderOf = (id: string) => entrants.find((entrant) => entrant.userId === id)!.gender;
      expect(new Set([genderOf(a), genderOf(b)])).toEqual(new Set(["MALE", "FEMALE"]));
    }
  });
  it("leaves gender-imbalanced or unset entrants unpaired", () => {
    const entrants = [
      { userId: "m1", skillRating: 5, gender: "MALE" as const },
      { userId: "m2", skillRating: 3, gender: "MALE" as const },
      { userId: "f1", skillRating: 4.5, gender: "FEMALE" as const },
      { userId: "x1", skillRating: 4, gender: null },
    ];
    const { teams, unpaired } = formMixedTeamsBalanced(entrants);
    expect(teams.length).toBe(1);
    expect(unpaired.map((entrant) => entrant.userId).sort()).toEqual(["m2", "x1"]);
  });
});

describe("formMixedTeamsRandom", () => {
  it("pairs one male with one female per team without regard to rating order", () => {
    const entrants = [
      { userId: "m1", gender: "MALE" as const },
      { userId: "m2", gender: "MALE" as const },
      { userId: "f1", gender: "FEMALE" as const },
      { userId: "f2", gender: "FEMALE" as const },
    ];
    const { teams, unpaired } = formMixedTeamsRandom(entrants);
    expect(teams.length).toBe(2);
    expect(unpaired.length).toBe(0);
    for (const [a, b] of teams) {
      const genderOf = (id: string) => entrants.find((entrant) => entrant.userId === id)!.gender;
      expect(new Set([genderOf(a), genderOf(b)])).toEqual(new Set(["MALE", "FEMALE"]));
    }
  });
});

describe("distributeIntoGroups / groupCountFromTargetSize", () => {
  it("splits evenly when it divides cleanly", () => {
    expect(distributeIntoGroups(12, 3)).toEqual([4, 4, 4]);
  });
  it("spreads the remainder across the first groups when it doesn't divide evenly", () => {
    expect(distributeIntoGroups(10, 3)).toEqual([4, 3, 3]);
    expect(distributeIntoGroups(10, 3).reduce((a, b) => a + b, 0)).toBe(10);
  });
  it("derives group count from a target group size", () => {
    expect(groupCountFromTargetSize(10, 4)).toBe(3);
    expect(groupCountFromTargetSize(12, 4)).toBe(3);
  });
});

describe("assignGroupsRandom", () => {
  it("assigns every team to exactly one group, sized per distributeIntoGroups", () => {
    const teamIds = Array.from({ length: 10 }, (_, i) => `t${i}`);
    const groups = assignGroupsRandom(teamIds, 3);
    expect(groups.map((group) => group.length)).toEqual([4, 3, 3]);
    expect(new Set(groups.flat())).toEqual(new Set(teamIds));
  });
});

describe("assignGroupsSeeded", () => {
  it("snake-drafts seeds so top seeds spread across groups instead of stacking one group", () => {
    const teams = Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, seed: i + 1 }));
    const groups = assignGroupsSeeded(teams, 2);
    // Seed 1 and 2 (the strongest) must land in different groups, not the same one.
    const groupOfSeed = (seed: number) => groups.findIndex((group) => group.includes(`t${seed - 1}`));
    expect(groupOfSeed(1)).not.toBe(groupOfSeed(2));
    expect(groups[0].length + groups[1].length).toBe(8);
  });
});

describe("generatePoolRounds", () => {
  it("has every team play every other team exactly once in a 4-team pool", () => {
    const rounds = generatePoolRounds(["a", "b", "c", "d"]);
    expect(rounds.length).toBe(3);
    const seenPairs = rounds.flatMap((round) => round.matchups.map((pair) => [...pair].sort().join("-")));
    expect(new Set(seenPairs).size).toBe(6); // C(4,2) = 6 unique pairings
    expect(seenPairs.length).toBe(6); // and none repeated
  });
  it("gives one team a bye each round when the pool is odd-sized, rotating fairly", () => {
    const teamIds = ["a", "b", "c", "d", "e"];
    const rounds = generatePoolRounds(teamIds);
    expect(rounds.length).toBe(5);
    const playCounts = new Map(teamIds.map((id) => [id, 0]));
    for (const round of rounds) for (const [x, y] of round.matchups) { playCounts.set(x, playCounts.get(x)! + 1); playCounts.set(y, playCounts.get(y)! + 1); }
    // Every team should play every other team exactly once: 4 matches each in a 5-team pool.
    expect([...playCounts.values()].every((count) => count === 4)).toBe(true);
  });
});
