import { describe, expect, it } from "vitest";
import { computePlayerRecap, computeRecap, computeRoundRobinStandings, playerRecapHeadline, recapShareText, type RecapMatch } from "./round-robin-recap";

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

  it("finds the biggest upset from the ratings going into each match", () => {
    const before = (matchId: string, ratings: Record<string, number>) => Object.entries(ratings).map(([userId, ratingBefore]) => ({ userId, matchId, ratingDelta: 0, ratingBefore }));
    const recap = computeRecap(matches, [
      ...before("m1", { Ann: 3, Bo: 3, Cy: 4.4, Di: 4.4 }), // Ann & Bo win 11-3 with a 31% chance
      ...before("m2", { Ann: 3, Cy: 3.6, Bo: 3, Di: 3.6 }), // even match
      ...before("m3", { Ann: 3, Di: 3.2, Bo: 3.6, Cy: 3.6 }), // 43%: an underdog win, but not an upset
    ])!;
    expect(recap.biggestUpset).toEqual({ matchId: "m1", winners: [{ userId: "Ann", name: "Ann" }, { userId: "Bo", name: "Bo" }], losers: [{ userId: "Cy", name: "Cy" }, { userId: "Di", name: "Di" }], winnerScore: 11, loserScore: 3, chance: 31 });
    expect(computeRecap(matches)!.biggestUpset).toBeNull();
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

describe("computePlayerRecap", () => {
  it("returns null for someone who didn't play a scored game", () => {
    expect(computePlayerRecap(matches, "Zed")).toBeNull();
  });

  it("sums up the champion's night", () => {
    const recap = computePlayerRecap(matches, "Ann")!;
    expect(recap).toMatchObject({ rank: 1, tiedWith: 0, players: 4, champion: true, wins: 3, losses: 0, differential: 21 });
    expect(recap.bestWin).toMatchObject({ matchId: "m3", winnerScore: 11, loserScore: 0 });
    expect(recap.closestGame).toMatchObject({ matchId: "m2", won: true });
    expect(recap.toughestOpponent).toBeNull();
    expect(playerRecapHeadline(recap)).toBe("You won · 3-0 · +21 points");
  });

  it("finds a mid-table player's best partner and toughest opponent", () => {
    // Bo: won with Ann (m1), lost with Di (m2), lost with Cy (m3).
    const recap = computePlayerRecap(matches, "Bo", [{ userId: "Bo", matchId: "m1", ratingDelta: 0.12 }, { userId: "Bo", matchId: "m3", ratingDelta: -0.2 }])!;
    expect(recap).toMatchObject({ rank: 3, players: 4, champion: false, wins: 1, losses: 2, differential: -5, ratingChange: -0.08 });
    expect(recap.bestPartner).toMatchObject({ name: "Ann", wins: 1, losses: 0 });
    expect(recap.toughestOpponent).toMatchObject({ name: "Ann", losses: 2 });
    expect(playerRecapHeadline(recap)).toBe("You finished 3rd of 4 · 1-2 · -5 points · rating −0.08");
  });

  it("reports a shared place", () => {
    const tied = [doubles("m1", ["Ann", "Bo"], ["Cy", "Di"], [11, 5]), doubles("m2", ["Cy", "Di"], ["Ann", "Bo"], [11, 5])];
    expect(computePlayerRecap(tied, "Cy")).toMatchObject({ rank: 1, tiedWith: 3, champion: true });
  });
});
