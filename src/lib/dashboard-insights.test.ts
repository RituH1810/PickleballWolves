import { describe, expect, it } from "vitest";
import { countdown, mergePulse, monthlyPosition, ratingNeighbors, recentRatingChange } from "./dashboard-insights";

const now = new Date(2026, 10, 3, 12);

describe("dashboard insights", () => {
  it("sums the last week's rating changes", () => {
    expect(recentRatingChange([
      { ratingDelta: 0.021, createdAt: new Date(2026, 10, 2) },
      { ratingDelta: -0.008, createdAt: new Date(2026, 9, 30) },
      { ratingDelta: 0.5, createdAt: new Date(2026, 9, 20) },
    ], now)).toBe(0.013);
  });

  it("counts down to the next game", () => {
    expect(countdown(new Date(2026, 10, 3, 15), now)).toBe("in 3 hours");
    expect(countdown(new Date(2026, 10, 4, 18), now)).toBe("tomorrow");
    expect(countdown(new Date(2026, 10, 6, 18), now)).toBe("in 3 days");
  });

  it("finds the nearest players above and below by rating", () => {
    const players = [{ userId: "s", name: "Sathish", rating: 3.12 }, { userId: "me", name: "Rakesh", rating: 3.089 }, { userId: "p", name: "Prateek", rating: 2.95 }, { userId: "a", name: "Arpit", rating: 3.4 }];
    expect(ratingNeighbors(players, "me")).toEqual({ place: 3, of: 4, above: { name: "Sathish", userId: "s", gap: 0.031 }, below: { name: "Prateek", userId: "p", gap: 0.139 } });
    expect(ratingNeighbors(players, "a")!.above).toBeNull();
    expect(ratingNeighbors(players, "zed")).toBeNull();
  });

  it("finds who's one spot ahead on the monthly board", () => {
    const ranked = [{ userId: "a", rank: 1, winPct: 0.7 }, { userId: "b", rank: 2, winPct: 0.6 }, { userId: "me", rank: 3, winPct: 0.55 }];
    expect(monthlyPosition(ranked, "me")).toEqual({ rank: 3, of: 3, winPct: 0.55, ahead: { userId: "b", winPct: 0.6 } });
    expect(monthlyPosition(ranked, "zed")).toBeNull();
  });

  it("merges group feeds newest first", () => {
    const pulse = mergePulse([
      { groupId: "g1", groupName: "One", items: [{ id: "x", at: new Date(2026, 10, 1) }, { id: "y", at: new Date(2026, 9, 1) }] },
      { groupId: "g2", groupName: "Two", items: [{ id: "z", at: new Date(2026, 10, 2) }] },
    ], 2);
    expect(pulse.map((item) => `${item.groupName}:${item.id}`)).toEqual(["Two:z", "One:x"]);
  });
});
