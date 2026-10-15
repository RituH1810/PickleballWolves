import { describe, expect, it } from "vitest";
import { computeRecap, computeRoundRobinStandings, recapShareText, type RecapMatch } from "./round-robin-recap";

function doubles(id: string, a: [string, string], b: [string, string], ...games: [number, number][]): RecapMatch {
  return {
    id,
    players: [...a.map((name) => ({ userId: name, name, side: "A" as const })), ...b.map((name) => ({ userId: name, name, side: "B" as const }))],
    scores: games.map(([sideAScore, sideBScore], index) => ({ gameNumber: index + 1, sideAScore, sideBScore })),
  };
}

const matches = [
  doubles("m1", ["Ann", "Bo"], ["Cy", "Di"], [11, 3]),
  doubles("m2", ["Ann", "Cy"], ["Bo", "Di"], [11, 9]),
  doubles("m3", ["Ann", "Di"], ["Bo", "Cy"], [11, 0]),
  doubles("m4", ["Bo", "Cy"], ["Ann", "Di"]), // never scored
];

describe("computeRoundRobinStandings", () => {
  it("ranks by game wins, then point differential", () => {
    const standings = computeRoundRobinStandings(matches);
    expect(standings.map((entry) => entry.name)).toEqual(["Ann", "Di", "Bo", "Cy"]);
    expect(standings[0]).toMatchObject({ wins: 3, losses: 0, scored: 33, conceded: 12, differential: 21, winPct: 100 });
  });
});

describe("computeRecap", () => {
  it("returns null before any game is scored", () => {
    expect(computeRecap([matches[3]])).toBeNull();
  });

  it("names the champion, podium, and highlights", () => {
    const recap = computeRecap(matches)!;
    expect(recap.champions.map((entry) => entry.name)).toEqual(["Ann"]);
    expect(recap.undefeated).toBe(true);
    expect(recap.podium.map((entry) => entry.name)).toEqual(["Ann", "Di", "Bo"]);
    expect(recap.totals).toEqual({ players: 4, games: 3, points: 45 });
    expect(recap.biggestWin).toMatchObject({ matchId: "m3", winnerScore: 11, loserScore: 0 });
    expect(recap.closestGame).toMatchObject({ matchId: "m2", winnerScore: 11, loserScore: 9 });
    expect(recap.shutouts).toBe(1);
    expect(recap.topScorer).toMatchObject({ name: "Ann", value: 33 });
  });

  it("shares the title on a dead heat", () => {
    const recap = computeRecap([doubles("m1", ["Ann", "Bo"], ["Cy", "Di"], [11, 5]), doubles("m2", ["Cy", "Di"], ["Ann", "Bo"], [11, 5])])!;
    expect(recap.champions).toHaveLength(4);
    expect(recap.undefeated).toBe(false);
  });

  it("doesn't repeat a single game as both biggest and closest", () => {
    const recap = computeRecap([matches[0]])!;
    expect(recap.biggestWin?.matchId).toBe("m1");
    expect(recap.closestGame).toBeNull();
  });

  it("sums rating changes from this round robin only", () => {
    const recap = computeRecap(matches, [
      { userId: "Bo", matchId: "m1", ratingDelta: 0.12 },
      { userId: "Bo", matchId: "m2", ratingDelta: -0.05 },
      { userId: "Cy", matchId: "m2", ratingDelta: 0.1 },
      { userId: "Cy", matchId: "other", ratingDelta: 0.9 },
    ])!;
    expect(recap.biggestRatingGain).toEqual({ userId: "Cy", name: "Cy", value: 0.1 });
  });
});

describe("recapShareText", () => {
  it("reads like a group-chat post", () => {
    const text = recapShareText("Lancaster Group - Oct 15, 2026", computeRecap(matches)!, "https://example.com/round-robin/x");
    expect(text).toContain("Champion: Ann (3-0) -- undefeated!");
    expect(text).toContain("1. Ann 3-0 (+21)");
    expect(text).toContain("Biggest win: Ann & Di 11-0");
    expect(text.endsWith("https://example.com/round-robin/x")).toBe(true);
  });
});
