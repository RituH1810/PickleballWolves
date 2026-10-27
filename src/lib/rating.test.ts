import { describe, expect, it } from "vitest";
import { matchResult, rateMatch, replayRatings } from "./rating";

const player = (userId: string, rating: number, ratedMatches = 20) => ({ userId, rating, ratedMatches });
const deltaOf = (changes: ReturnType<typeof rateMatch>, userId: string) => changes.find((change) => change.userId === userId)!.delta;

describe("matchResult", () => {
  it("goes by games won, then points", () => {
    expect(matchResult([{ sideAScore: 11, sideBScore: 9 }])).toEqual({ winner: "A", pointsA: 11, pointsB: 9 });
    expect(matchResult([{ sideAScore: 11, sideBScore: 2 }, { sideAScore: 9, sideBScore: 11 }, { sideAScore: 8, sideBScore: 11 }])).toMatchObject({ winner: "B", pointsA: 28, pointsB: 24 });
    expect(matchResult([{ sideAScore: 10, sideBScore: 10 }])).toBeNull();
  });
});

describe("rateMatch", () => {
  it("moves winners up and losers down, to three decimals", () => {
    const changes = rateMatch([player("a1", 4), player("a2", 4)], [player("b1", 4), player("b2", 4)], { winner: "A", pointsA: 11, pointsB: 7 });
    expect(deltaOf(changes, "a1")).toBeGreaterThan(0);
    expect(deltaOf(changes, "b1")).toBe(-deltaOf(changes, "a1"));
    expect(String(changes[0].after).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(3);
  });

  it("gives partners different changes: the stronger partner gains less for a win", () => {
    const changes = rateMatch([player("strong", 5), player("weak", 3)], [player("b1", 4), player("b2", 4)], { winner: "A", pointsA: 11, pointsB: 8 });
    expect(deltaOf(changes, "weak")).toBeGreaterThan(deltaOf(changes, "strong"));
    expect(deltaOf(changes, "strong")).toBeGreaterThan(0);
  });

  it("moves more for a blowout than a close game", () => {
    const sides = [[player("a", 4)], [player("b", 4)]] as const;
    const close = deltaOf(rateMatch([...sides[0]], [...sides[1]], { winner: "A", pointsA: 11, pointsB: 10 }), "a");
    const blowout = deltaOf(rateMatch([...sides[0]], [...sides[1]], { winner: "A", pointsA: 11, pointsB: 0 }), "a");
    expect(blowout).toBeGreaterThan(close * 2);
  });

  it("moves new players twice as fast", () => {
    const changes = rateMatch([player("new", 4, 0)], [player("old", 4)], { winner: "A", pointsA: 11, pointsB: 5 });
    expect(deltaOf(changes, "new")).toBeCloseTo(-2 * deltaOf(changes, "old"), 2);
  });

  it("keeps ratings inside 2.0-6.0", () => {
    const changes = rateMatch([player("top", 5.99)], [player("bottom", 2.01)], { winner: "A", pointsA: 11, pointsB: 0 });
    expect(changes.find((change) => change.userId === "top")!.after).toBeLessThanOrEqual(6);
    expect(changes.find((change) => change.userId === "bottom")!.after).toBeGreaterThanOrEqual(2);
  });
});

describe("replayRatings", () => {
  it("rates matches in order from the starting ratings, skipping level ones", () => {
    const { ratings, changes } = replayRatings(new Map([["a", 4], ["b", 4]]), [
      { id: "m1", players: [{ userId: "a", side: "A" }, { userId: "b", side: "B" }], scores: [{ sideAScore: 11, sideBScore: 5 }] },
      { id: "m2", players: [{ userId: "a", side: "A" }, { userId: "b", side: "B" }], scores: [{ sideAScore: 9, sideBScore: 9 }] },
      { id: "m3", players: [{ userId: "a", side: "B" }, { userId: "b", side: "A" }], scores: [{ sideAScore: 11, sideBScore: 9 }] },
    ]);
    expect([...changes.keys()]).toEqual(["m1", "m3"]);
    expect(changes.get("m3")!.find((change) => change.userId === "a")!.before).toBe(changes.get("m1")!.find((change) => change.userId === "a")!.after);
    expect(ratings.get("a")).toBe(changes.get("m3")!.find((change) => change.userId === "a")!.after);
  });
});
