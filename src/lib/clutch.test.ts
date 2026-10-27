import { describe, expect, it } from "vitest";
import { computeClutch } from "./clutch";
import type { RivalryMatch } from "./rivalry";

let count = 0;
function match(a: string[], b: string[], ...games: [number, number][]): RivalryMatch {
  count += 1;
  return {
    id: `m${count}`,
    playedAt: new Date(2026, 9, count),
    event: "Lancaster Group",
    players: [...a.map((userId) => ({ userId, name: userId, side: "A" as const })), ...b.map((userId) => ({ userId, name: userId, side: "B" as const }))],
    scores: games.map(([sideAScore, sideBScore]) => ({ sideAScore, sideBScore })),
  };
}

describe("computeClutch", () => {
  it("counts close games against the overall game record", () => {
    const stats = computeClutch([
      match(["ann", "bo"], ["x", "y"], [11, 9]),
      match(["x", "y"], ["ann", "bo"], [10, 12]),
      match(["ann", "bo"], ["x", "y"], [12, 10]),
      match(["ann", "bo"], ["x", "y"], [11, 10]),
      match(["ann", "bo"], ["x", "y"], [9, 11]),
      match(["ann", "bo"], ["x", "y"], [3, 11]),
      match(["ann", "bo"], ["x", "y"], [5, 11]),
      match(["ann", "bo"], ["x", "y"], [10, 10]),
    ], "ann", new Map());
    expect(stats.close).toEqual({ wins: 4, losses: 1, winPct: 80 });
    expect(stats.overall).toEqual({ wins: 4, losses: 3, winPct: 57 });
    expect(stats.verdict).toBe("clutch");
  });

  it("holds the verdict until enough close games", () => {
    expect(computeClutch([match(["ann"], ["x"], [11, 9])], "ann", new Map()).verdict).toBeNull();
  });

  it("uses the ratings going in for underdog matches and upsets, skipping unrated ones", () => {
    const upset = match(["ann", "bo"], ["x", "y"], [11, 6]);
    const loss = match(["ann", "bo"], ["x", "y"], [7, 11]);
    const unrated = match(["ann", "bo"], ["x", "y"], [11, 2]);
    const ratings = new Map<string, number>();
    for (const rated of [upset, loss]) for (const [userId, rating] of [["ann", 3], ["bo", 3], ["x", 4.5], ["y", 4.5]] as const) ratings.set(`${rated.id}:${userId}`, rating);
    const stats = computeClutch([upset, loss, unrated], "ann", ratings);
    expect(stats.underdog).toEqual({ wins: 1, losses: 1 });
    expect(stats.upsetWins).toBe(1);
  });

  it("counts comebacks after losing the first game", () => {
    const stats = computeClutch([
      match(["ann"], ["x"], [8, 11], [11, 4], [11, 6]),
      match(["ann"], ["x"], [9, 11], [11, 9], [5, 11]),
      match(["ann"], ["x"], [11, 3], [11, 5]),
    ], "ann", new Map());
    expect(stats.comebacks).toEqual({ wins: 1, chances: 2 });
  });
});
