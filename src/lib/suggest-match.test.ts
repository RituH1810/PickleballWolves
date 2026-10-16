import { describe, expect, it } from "vitest";
import { suggestMatches, type SuggestMatch } from "./suggest-match";

const players = [
  { id: "ann", rating: 4.5 },
  { id: "bo", rating: 3.0 },
  { id: "cy", rating: 4.0 },
  { id: "di", rating: 3.5 },
  { id: "ed", rating: 3.2 },
  { id: "fay", rating: 3.8 },
];

function match(minute: number, a: string[], b: string[], scored = true): SuggestMatch {
  return { createdAt: new Date(2026, 9, 15, 18, minute), scored, players: [...a.map((userId) => ({ userId, side: "A" as const })), ...b.map((userId) => ({ userId, side: "B" as const }))] };
}

describe("suggestMatches", () => {
  it("balances the first match of the night by rating", () => {
    const four = players.slice(0, 4); // ann 4.5, bo 3.0, cy 4.0, di 3.5
    const [best] = suggestMatches(four, [], 2);
    // ann+bo (3.75) vs cy+di (3.75) is the only perfectly even split.
    expect([best.teamA.sort(), best.teamB.sort()].sort()).toEqual([["ann", "bo"], ["cy", "di"]]);
    expect(best.ratingGap).toBe(0);
  });

  it("puts whoever sat out first and skips players on court", () => {
    const tonight = [match(0, ["ann", "bo"], ["cy", "di"]), match(1, ["ed", "fay"], ["ann", "cy"], false)];
    const [best] = suggestMatches(players, tonight, 2);
    // ed, fay, ann, cy are on court (unscored); only bo and di are free -- not enough for doubles.
    expect(best).toBeUndefined();
    const [next] = suggestMatches(players, [match(0, ["ann", "bo"], ["cy", "di"])], 2);
    // ed and fay haven't played yet, so they must be in it.
    expect([...next.teamA, ...next.teamB]).toEqual(expect.arrayContaining(["ed", "fay"]));
  });

  it("avoids repeating last game's partners", () => {
    const four = players.slice(0, 4);
    const [best] = suggestMatches(four, [match(0, ["ann", "bo"], ["cy", "di"])], 2);
    const pairs = [best.teamA.sort().join("+"), best.teamB.sort().join("+")];
    expect(pairs).not.toContain("ann+bo");
    expect(pairs).not.toContain("cy+di");
  });

  it("works for singles and returns ranked alternatives for Shuffle", () => {
    const options = suggestMatches(players, [], 1, 5);
    expect(options).toHaveLength(5);
    expect(options[0].teamA).toHaveLength(1);
    expect(new Set(options.map((option) => [...option.teamA, ...option.teamB].sort().join()))).not.toHaveProperty("size", 1);
  });

  it("needs enough free players", () => {
    expect(suggestMatches(players.slice(0, 3), [], 2)).toEqual([]);
  });
});
