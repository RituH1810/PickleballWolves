import { describe, expect, it } from "vitest";
import {
  assignGroupsRandom,
  assignGroupsSeeded,
  bracketRoundLabel,
  buildBracket,
  computeTeamStandings,
  distributeIntoGroups,
  formMixedTeamsBalanced,
  formMixedTeamsRandom,
  formTeamsBalanced,
  formTeamsRandom,
  generatePoolRounds,
  groupCountFromTargetSize,
  nextPowerOfTwo,
  seedQualifiers,
  skillLevelForRating,
  standardSeedOrder,
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

describe("computeTeamStandings", () => {
  it("ranks by wins then point differential", () => {
    const matches = [
      { tournamentTeamAId: "a", tournamentTeamBId: "b", scores: [{ sideAScore: 11, sideBScore: 5 }] },
      { tournamentTeamAId: "a", tournamentTeamBId: "c", scores: [{ sideAScore: 8, sideBScore: 11 }] },
      { tournamentTeamAId: "b", tournamentTeamBId: "c", scores: [{ sideAScore: 11, sideBScore: 9 }] },
    ];
    const standings = computeTeamStandings(["a", "b", "c"], matches);
    // All 1-1, ranked by differential: a scored 19/conceded 16 (+3), c 20/19 (+1), b 16/20 (-4).
    expect(standings.map((entry) => entry.teamId)).toEqual(["a", "c", "b"]);
    expect(standings.find((entry) => entry.teamId === "a")).toMatchObject({ wins: 1, losses: 1, differential: 3 });
  });
  it("ignores matches with no score yet or an unassigned side", () => {
    const matches = [{ tournamentTeamAId: "a", tournamentTeamBId: "b", scores: [] }, { tournamentTeamAId: null, tournamentTeamBId: "b", scores: [{ sideAScore: 11, sideBScore: 0 }] }];
    const standings = computeTeamStandings(["a", "b"], matches);
    expect(standings.every((entry) => entry.wins === 0 && entry.losses === 0)).toBe(true);
  });
});

describe("nextPowerOfTwo", () => {
  it("returns the value itself when already a power of two", () => {
    expect(nextPowerOfTwo(1)).toBe(1);
    expect(nextPowerOfTwo(4)).toBe(4);
    expect(nextPowerOfTwo(8)).toBe(8);
  });
  it("rounds up to the next power of two otherwise", () => {
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(9)).toBe(16);
  });
});

describe("standardSeedOrder", () => {
  it("matches the well-known standard bracket orders", () => {
    expect(standardSeedOrder(2)).toEqual([1, 2]);
    expect(standardSeedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(standardSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe("seedQualifiers", () => {
  it("ranks all pool winners before any runner-up, tiebreaking within a rank by wins then differential", () => {
    const qualifiers = [
      { teamId: "b-2nd", poolRank: 2, wins: 2, differential: 5 },
      { teamId: "a-1st", poolRank: 1, wins: 3, differential: 10 },
      { teamId: "b-1st", poolRank: 1, wins: 3, differential: 20 },
      { teamId: "a-2nd", poolRank: 2, wins: 1, differential: 1 },
    ];
    const seeded = seedQualifiers(qualifiers);
    expect(seeded.map((q) => q.teamId)).toEqual(["b-1st", "a-1st", "b-2nd", "a-2nd"]);
    expect(seeded.map((q) => q.seed)).toEqual([1, 2, 3, 4]);
  });
});

describe("buildBracket", () => {
  it("returns nothing for fewer than 2 qualifiers", () => {
    expect(buildBracket([])).toEqual([]);
    expect(buildBracket([{ teamId: "a", seed: 1 }])).toEqual([]);
  });

  it("builds a single final match for 2 qualifiers", () => {
    const plans = buildBracket([{ teamId: "a", seed: 1 }, { teamId: "b", seed: 2 }]);
    expect(plans).toEqual([{ round: 1, position: 0, teamAId: "a", teamBId: "b", nextRound: null, nextPosition: null, nextSlot: null }]);
  });

  it("gives the top seed a bye and still wires up the final correctly for 3 qualifiers", () => {
    const plans = buildBracket([{ teamId: "t1", seed: 1 }, { teamId: "t2", seed: 2 }, { teamId: "t3", seed: 3 }]);
    // Round 1: only seed2 vs seed3 is a real match (seed1's bye isn't a row at all).
    expect(plans.filter((plan) => plan.round === 1)).toEqual([
      { round: 1, position: 1, teamAId: "t2", teamBId: "t3", nextRound: 2, nextPosition: 0, nextSlot: "B" },
    ]);
    // The final already has seed1 (the bye recipient) locked into slot A, waiting on the other side.
    expect(plans.filter((plan) => plan.round === 2)).toEqual([
      { round: 2, position: 0, teamAId: "t1", teamBId: null, nextRound: null, nextPosition: null, nextSlot: null },
    ]);
  });

  it("lets two bye recipients meet immediately in round 2 without waiting on round 1", () => {
    const qualifiers = [1, 2, 3, 4, 5].map((seed) => ({ teamId: `t${seed}`, seed }));
    const plans = buildBracket(qualifiers);
    // 5 qualifiers -> bracket of 8 -> 3 byes (seeds 1, 2, 3) leave only one real round-1 match (4v5).
    const round1 = plans.filter((plan) => plan.round === 1);
    expect(round1).toEqual([{ round: 1, position: 1, teamAId: "t4", teamBId: "t5", nextRound: 2, nextPosition: 0, nextSlot: "B" }]);
    // Round 2 has both a pending match (seed1 waiting on the 4v5 winner) and an immediately
    // playable one (seed2 vs seed3, both already resolved via their round-1 byes).
    const round2 = plans.filter((plan) => plan.round === 2);
    expect(round2).toEqual([
      { round: 2, position: 0, teamAId: "t1", teamBId: null, nextRound: 3, nextPosition: 0, nextSlot: "A" },
      { round: 2, position: 1, teamAId: "t2", teamBId: "t3", nextRound: 3, nextPosition: 0, nextSlot: "B" },
    ]);
    // The final is fully empty, waiting on both round-2 results.
    expect(plans.filter((plan) => plan.round === 3)).toEqual([{ round: 3, position: 0, teamAId: null, teamBId: null, nextRound: null, nextPosition: null, nextSlot: null }]);
  });

  it("produces a fully-filled bracket with no byes when the qualifier count is already a power of two", () => {
    const qualifiers = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => ({ teamId: `t${seed}`, seed }));
    const plans = buildBracket(qualifiers);
    expect(plans.filter((plan) => plan.round === 1).length).toBe(4);
    expect(plans.filter((plan) => plan.round === 1).every((plan) => plan.teamAId && plan.teamBId)).toBe(true);
    expect(plans.filter((plan) => plan.round === 2).length).toBe(2);
    expect(plans.filter((plan) => plan.round === 3)).toEqual([{ round: 3, position: 0, teamAId: null, teamBId: null, nextRound: null, nextPosition: null, nextSlot: null }]);
  });
});

describe("bracketRoundLabel", () => {
  it("names rounds relative to the final", () => {
    expect(bracketRoundLabel(3, 3)).toBe("Final");
    expect(bracketRoundLabel(2, 3)).toBe("Semifinal");
    expect(bracketRoundLabel(1, 3)).toBe("Quarterfinal");
    expect(bracketRoundLabel(1, 4)).toBe("Round of 16");
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
