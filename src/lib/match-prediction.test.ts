import { describe, expect, it } from "vitest";
import { expectedWin, isUpset, predictMatch } from "./match-prediction";

describe("match predictions", () => {
  it("uses the rating model's expected result", () => {
    expect(expectedWin(3, 3)).toBe(0.5);
    expect(expectedWin(4, 3)).toBeCloseTo(0.64, 2); // a full point better wins about 64%
    expect(expectedWin(3, 4) + expectedWin(4, 3)).toBeCloseTo(1, 10);
  });

  it("averages each side and picks a favorite", () => {
    expect(predictMatch([4.5, 3.5], [3.5, 3.5])).toEqual({ chanceA: 57, favorite: "A" });
    expect(predictMatch([3], [4.4])).toEqual({ chanceA: 31, favorite: "B" });
    expect(predictMatch([3.5, 3.4], [3.45, 3.45])).toEqual({ chanceA: 50, favorite: null });
    expect(predictMatch([], [3])).toBeNull();
  });

  it("calls an upset only when the underdog wins", () => {
    const prediction = predictMatch([3], [4.4]);
    expect(isUpset(prediction, "A")).toBe(true);
    expect(isUpset(prediction, "B")).toBe(false);
    expect(isUpset(predictMatch([3.5], [3.6]), "A")).toBe(false);
    expect(isUpset(null, "A")).toBe(false);
  });
});
