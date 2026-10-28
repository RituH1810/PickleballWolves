import { describe, expect, it } from "vitest";
import { expectedPointShare, kFactor, replayRatings, type RatedMatch } from "./rating";

const match = (id: string, a: string[], b: string[], scoreA: number, scoreB: number): RatedMatch => ({
  id,
  players: [...a.map((userId) => ({ userId, side: "A" as const })), ...b.map((userId) => ({ userId, side: "B" as const }))],
  scores: [{ sideAScore: scoreA, sideBScore: scoreB }],
});

describe("rating model", () => {
  it("expects stronger teams to win more of the points", () => {
    expect(expectedPointShare(4, 4)).toBe(0.5);
    expect(expectedPointShare(5, 4)).toBeCloseTo(0.571, 3);
    expect(kFactor(0)).toBeCloseTo(0.2, 5);
    expect(kFactor(100)).toBeCloseTo(0.05, 2);
  });

  it("uses the score margin: a blowout moves ratings more than a squeaker", () => {
    const start = new Map([["a", 4], ["b", 4], ["c", 4], ["d", 4]]);
    const close = replayRatings([match("m", ["a", "b"], ["c", "d"], 11, 10)], start).ratings;
    const blowout = replayRatings([match("m", ["a", "b"], ["c", "d"], 11, 2)], start).ratings;
    expect(close.get("a")! - 4).toBeGreaterThan(0);
    expect(blowout.get("a")! - 4).toBeGreaterThan(close.get("a")! - 4);
    expect(close.get("c")! - 4).toBeCloseTo(-(close.get("a")! - 4), 3);
  });

  it("can cost the favorite rating even in a win, like DUPR", () => {
    const start = new Map([["a", 5.5], ["b", 5.5], ["c", 3], ["d", 3]]);
    const { ratings } = replayRatings([match("m", ["a", "b"], ["c", "d"], 11, 10)], start);
    expect(ratings.get("a")).toBeLessThan(5.5);
    expect(ratings.get("c")).toBeGreaterThan(3);
  });

  it("moves new players more than established ones on the same result", () => {
    const veteranHistory = Array.from({ length: 40 }, (_, index) => match(`v${index}`, ["vet", "x"], ["y", "z"], 11, 11));
    const start = new Map([["vet", 4], ["new", 4], ["x", 4], ["y", 4], ["z", 4], ["c", 4], ["d", 4]]);
    const { changes } = replayRatings([...veteranHistory, match("m", ["vet", "new"], ["c", "d"], 11, 5)], start);
    const last = changes.filter((change) => change.matchId === "m");
    const delta = (userId: string) => last.find((change) => change.userId === userId)!.ratingDelta;
    expect(delta("new")).toBeGreaterThan(delta("vet"));
    expect(delta("vet")).toBeGreaterThan(0);
  });

  it("replays in order, so a corrected score gives the corrected ratings", () => {
    const start = new Map([["a", 4], ["b", 4], ["c", 4], ["d", 4]]);
    const wrong = replayRatings([match("m", ["a", "b"], ["c", "d"], 10, 11)], start).ratings;
    const fixed = replayRatings([match("m", ["a", "b"], ["c", "d"], 11, 10)], start).ratings;
    expect(wrong.get("a")).toBeLessThan(4);
    expect(fixed.get("a")).toBeGreaterThan(4);
  });
});
