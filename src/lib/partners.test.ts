import { describe, expect, it } from "vitest";
import { computePartners } from "./partners";
import type { RivalryMatch } from "./rivalry";

let day = 0;
function match(a: string[], b: string[], ...games: [number, number][]): RivalryMatch {
  day += 1;
  return {
    id: `m${day}`,
    playedAt: new Date(2026, 9, day),
    event: "Lancaster Group",
    players: [...a.map((userId) => ({ userId, name: userId.toUpperCase(), side: "A" as const })), ...b.map((userId) => ({ userId, name: userId.toUpperCase(), side: "B" as const }))],
    scores: games.map(([sideAScore, sideBScore]) => ({ sideAScore, sideBScore })),
  };
}

describe("computePartners", () => {
  const history = [
    // ann + bo: 4 matches, 3-1
    match(["ann", "bo"], ["x", "y"], [11, 5]),
    match(["x", "y"], ["ann", "bo"], [7, 11]),
    match(["ann", "bo"], ["x", "y"], [11, 9]),
    match(["ann", "bo"], ["x", "y"], [4, 11]),
    // ann + cy: 3 matches, 3-0
    match(["ann", "cy"], ["x", "y"], [11, 8]),
    match(["ann", "cy"], ["x", "y"], [11, 6]),
    match(["y", "x"], ["cy", "ann"], [9, 11]),
    // ann + dee: 2 matches, 2-0 (too few to be best)
    match(["ann", "dee"], ["x", "y"], [11, 1]),
    match(["ann", "dee"], ["x", "y"], [11, 2]),
    match(["ann", "bo"], ["x", "y"], [10, 10]), // tied, skipped
    match(["ann"], ["x"], [11, 3]), // singles, no partner
    match(["ann", "x"], ["y", "z"]), // unscored
  ];
  const { best, partners } = computePartners(history, "ann");

  it("records every partner from the player's side, most-played first", () => {
    expect(partners.map((partner) => partner.userId)).toEqual(["bo", "cy", "dee"]);
    expect(partners[0]).toMatchObject({ name: "BO", wins: 3, losses: 1, played: 4, winRate: 0.75, pointDiff: 6 + 4 + 2 - 7 });
    expect(partners[1]).toMatchObject({ wins: 3, losses: 0, pointDiff: 3 + 5 + 2 });
  });

  it("picks the best win rate among partners with enough matches", () => {
    expect(best).toMatchObject({ userId: "cy", played: 3, winRate: 1 });
  });

  it("breaks win-rate ties by matches together", () => {
    const tied = [
      ...Array.from({ length: 3 }, () => match(["ann", "bo"], ["x", "y"], [11, 3])),
      ...Array.from({ length: 4 }, () => match(["ann", "cy"], ["x", "y"], [11, 9])),
    ];
    expect(computePartners(tied, "ann").best).toMatchObject({ userId: "cy", played: 4 });
  });

  it("has no best partner until someone reaches the minimum", () => {
    expect(computePartners([match(["ann", "bo"], ["x", "y"], [11, 5])], "ann")).toMatchObject({ best: null, partners: [{ userId: "bo", played: 1 }] });
  });
});
