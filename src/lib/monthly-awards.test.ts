import { describe, expect, it } from "vitest";
import { awardsAnnouncement, computeMonthlyAwards, monthLabel } from "./monthly-awards";
import type { RecapMatch } from "./round-robin-recap";

function doubles(id: string, a: [string, string], b: [string, string], ...games: [number, number][]): RecapMatch {
  return {
    id,
    players: [...a.map((name) => ({ userId: name, name, side: "A" as const })), ...b.map((name) => ({ userId: name, name, side: "B" as const }))],
    scores: games.map(([sideAScore, sideBScore], index) => ({ gameNumber: index + 1, sideAScore, sideBScore })),
  };
}

// Ann & Bo win 4 of 5 together; Ann also plays an extra game, making her the Iron Wolf.
const matches = [
  doubles("m1", ["Ann", "Bo"], ["Cy", "Di"], [11, 5]),
  doubles("m2", ["Ann", "Bo"], ["Cy", "Di"], [11, 7]),
  doubles("m3", ["Ann", "Bo"], ["Cy", "Di"], [9, 11]),
  doubles("m4", ["Ann", "Bo"], ["Cy", "Di"], [11, 8]),
  doubles("m5", ["Ann", "Bo"], ["Cy", "Di"], [11, 2]),
  doubles("m6", ["Ann", "Cy"], ["Bo", "Ed"], [11, 6]),
];

describe("computeMonthlyAwards", () => {
  it("gives Iron Wolf to whoever played the most games, sharing ties", () => {
    const iron = computeMonthlyAwards(matches, []).filter((award) => award.award === "IRON_WOLF");
    expect(iron.map((award) => award.name).sort()).toEqual(["Ann", "Bo", "Cy"]);
    expect(iron[0]).toMatchObject({ value: 6, detail: "6 games played" });
  });

  it("gives Best Partnership to the best qualifying pair, once for each partner", () => {
    const pairs = computeMonthlyAwards(matches, []).filter((award) => award.award === "BEST_PARTNERSHIP");
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toMatchObject({ name: "Ann", partnerName: "Bo", detail: "4-1 together" });
    expect(pairs[1]).toMatchObject({ name: "Bo", partnerName: "Ann" });
  });

  it("only counts this month's games for Most Improved, and needs enough games", () => {
    const deltas = [
      { userId: "Cy", matchId: "m1", ratingDelta: 0.1 },
      { userId: "Cy", matchId: "m6", ratingDelta: 0.3 },
      { userId: "Ann", matchId: "m1", ratingDelta: 0.2 },
      { userId: "Ann", matchId: "older", ratingDelta: 2 },
      { userId: "Ed", matchId: "m6", ratingDelta: 0.9 }, // only 1 game -- doesn't qualify
    ];
    const improved = computeMonthlyAwards(matches, deltas).filter((award) => award.award === "MOST_IMPROVED");
    expect(improved).toEqual([expect.objectContaining({ name: "Cy", value: 0.4, detail: "+0.40 rating" })]);
  });

  it("skips awards nobody qualifies for", () => {
    const awards = computeMonthlyAwards([doubles("m1", ["Ann", "Bo"], ["Cy", "Di"], [11, 5])], []);
    expect(awards.map((award) => award.award)).toEqual(["IRON_WOLF", "IRON_WOLF", "IRON_WOLF", "IRON_WOLF"]);
    expect(computeMonthlyAwards([], [])).toEqual([]);
  });
});

describe("awardsAnnouncement", () => {
  it("lists each award once, partnerships as a pair", () => {
    const { title, body } = awardsAnnouncement("2026-10", computeMonthlyAwards(matches, [{ userId: "Cy", matchId: "m1", ratingDelta: 0.25 }]));
    expect(monthLabel("2026-10")).toBe("October 2026");
    expect(title).toBe("October 2026 awards");
    expect(body).toContain("Most Improved: Cy (+0.25 rating)");
    expect(body).toContain("Best Partnership: Ann & Bo (4-1 together)");
    expect(body.match(/Ann & Bo/g)).toHaveLength(1);
  });
});
