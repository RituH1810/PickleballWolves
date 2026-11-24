import { describe, expect, it } from "vitest";
import { computeWinStreaks, type StreakMatch, topStreakRuns } from "./win-streak";

let day = 0;
const match = (id: string, won: boolean | null): StreakMatch => ({
  id,
  playedAt: new Date(Date.UTC(2026, 9, 1 + day++)),
  winnerSide: null,
  players: [{ userId: "me", side: "A" }, { userId: "them", side: "B" }],
  scores: [{ gameNumber: 1, sideAScore: won === null ? 10 : won ? 11 : 5, sideBScore: won === null ? 10 : won ? 5 : 11 }],
});

describe("computeWinStreaks", () => {
  it("finds the longest run and the current one", () => {
    const streaks = computeWinStreaks([match("a", true), match("b", true), match("c", true), match("d", false), match("e", true)], "me");
    expect(streaks).toMatchObject({ best: { length: 3, matchIds: ["a", "b", "c"] }, current: 1 });
  });

  it("ends a run on a tie and prefers the most recent of equal runs", () => {
    const streaks = computeWinStreaks([match("a", true), match("b", null), match("c", true), match("d", false)], "me");
    expect(streaks).toMatchObject({ best: { length: 1, matchIds: ["c"] }, current: 0 });
  });

  it("is empty with no wins", () => {
    expect(computeWinStreaks([match("a", false)], "me")).toMatchObject({ best: { length: 0, matchIds: [] }, current: 0 });
    expect(computeWinStreaks([], "me").best.length).toBe(0);
  });
});

describe("topStreakRuns", () => {
  // Rakesh's games Nov 14-23: W | L W W L W W | W x7 | W L L W W W
  const day = (date: number, minute: number) => new Date(2026, 10, date, 18, minute);
  const results = [
    [14, "W"], [16, "L"], [16, "W"], [16, "W"], [16, "L"], [16, "W"], [16, "W"],
    [19, "W"], [19, "W"], [19, "W"], [19, "W"], [19, "W"], [19, "W"], [19, "W"],
    [23, "W"], [23, "L"], [23, "L"], [23, "W"], [23, "W"], [23, "W"],
  ].map(([date, result], index) => ({ won: result === "W", at: day(date as number, index) }));

  it("lists each separate run once, longest first, marking one still going", () => {
    const runs = topStreakRuns(results);
    expect(runs.map((run) => [run.length, run.start.getDate(), run.end.getDate(), run.ongoing])).toEqual([
      [10, 16, 23, false], // last 2 on Nov 16, all 7 on Nov 19, the first on Nov 23
      [3, 23, 23, true],
      [2, 16, 16, false],
    ]);
  });

  it("keeps the top five and skips single wins", () => {
    const alternating = Array.from({ length: 30 }, (_, index) => ({ won: index % 3 !== 2, at: day(1, index) }));
    expect(topStreakRuns(alternating)).toHaveLength(5);
    expect(topStreakRuns([{ won: true, at: day(1, 0) }, { won: false, at: day(1, 1) }])).toEqual([]);
  });
});
