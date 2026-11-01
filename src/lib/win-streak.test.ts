import { describe, expect, it } from "vitest";
import { computeWinStreaks, type StreakMatch } from "./win-streak";

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
    expect(streaks).toEqual({ best: { length: 3, matchIds: ["a", "b", "c"] }, current: 1 });
  });

  it("ends a run on a tie and prefers the most recent of equal runs", () => {
    const streaks = computeWinStreaks([match("a", true), match("b", null), match("c", true), match("d", false)], "me");
    expect(streaks).toEqual({ best: { length: 1, matchIds: ["c"] }, current: 0 });
  });

  it("is empty with no wins", () => {
    expect(computeWinStreaks([match("a", false)], "me")).toEqual({ best: { length: 0, matchIds: [] }, current: 0 });
    expect(computeWinStreaks([], "me").best.length).toBe(0);
  });
});
