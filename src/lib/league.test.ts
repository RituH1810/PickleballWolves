import { describe, expect, it } from "vitest";
import { computeLeagueStandings } from "./league";

describe("computeLeagueStandings", () => {
  it("ranks by wins then point differential", () => {
    const matches = [
      { teamAId: "a", teamBId: "b", scores: [{ sideAScore: 11, sideBScore: 5 }] },
      { teamAId: "a", teamBId: "c", scores: [{ sideAScore: 8, sideBScore: 11 }] },
      { teamAId: "b", teamBId: "c", scores: [{ sideAScore: 11, sideBScore: 9 }] },
    ];
    const standings = computeLeagueStandings(["a", "b", "c"], matches);
    // All 1-1, ranked by differential: a scored 19/conceded 16 (+3), c 20/19 (+1), b 16/20 (-4).
    expect(standings.map((entry) => entry.teamId)).toEqual(["a", "c", "b"]);
    expect(standings.find((entry) => entry.teamId === "a")).toMatchObject({ wins: 1, losses: 1, differential: 3 });
  });
  it("ignores matches with no score yet or an unassigned side", () => {
    const matches = [{ teamAId: "a", teamBId: "b", scores: [] }, { teamAId: null, teamBId: "b", scores: [{ sideAScore: 11, sideBScore: 0 }] }];
    const standings = computeLeagueStandings(["a", "b"], matches);
    expect(standings.every((entry) => entry.wins === 0 && entry.losses === 0)).toBe(true);
  });
  it("accumulates multiple matches (e.g. a multi-week season) between the same pair", () => {
    const matches = [
      { teamAId: "a", teamBId: "b", scores: [{ sideAScore: 11, sideBScore: 9 }] },
      { teamAId: "a", teamBId: "b", scores: [{ sideAScore: 7, sideBScore: 11 }] },
    ];
    const standings = computeLeagueStandings(["a", "b"], matches);
    const a = standings.find((entry) => entry.teamId === "a")!;
    const b = standings.find((entry) => entry.teamId === "b")!;
    expect(a).toMatchObject({ wins: 1, losses: 1, scored: 18, conceded: 20, differential: -2 });
    expect(b).toMatchObject({ wins: 1, losses: 1, scored: 20, conceded: 18, differential: 2 });
  });
});
