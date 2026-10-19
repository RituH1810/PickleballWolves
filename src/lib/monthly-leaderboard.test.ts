import { describe, expect, it } from "vitest";
import { computeMonthlyLeaderboard, monthOf, recentMonths, type LeaderboardMatch } from "./monthly-leaderboard";

function match(a: [string, string], b: [string, string], scoreA: number, scoreB: number, playedAt = new Date("2026-10-10T22:30:00Z")): LeaderboardMatch {
  return { playedAt, players: [...a.map((userId) => ({ userId, side: "A" as const })), ...b.map((userId) => ({ userId, side: "B" as const }))], scores: [{ sideAScore: scoreA, sideBScore: scoreB }] };
}

describe("recentMonths", () => {
  it("lists this month and the two before it, in Eastern time", () => {
    const months = recentMonths(new Date("2026-10-19T12:00:00Z"));
    expect(months.map((month) => month.key)).toEqual(["2026-10", "2026-09", "2026-08"]);
    expect(months[0]).toMatchObject({ label: "October 2026", isCurrent: true });
    expect(months[0].start.toISOString()).toBe("2026-10-01T04:00:00.000Z"); // midnight EDT
    expect(months[0].end.toISOString()).toBe("2026-11-01T04:00:00.000Z");
  });

  it("crosses the new year and daylight saving", () => {
    const months = recentMonths(new Date("2027-01-15T12:00:00Z"));
    expect(months.map((month) => month.key)).toEqual(["2027-01", "2026-12", "2026-11"]);
    expect(months[0].start.toISOString()).toBe("2027-01-01T05:00:00.000Z"); // midnight EST
  });

  it("puts a late-evening game on the last day in the right month", () => {
    const months = recentMonths(new Date("2026-11-05T12:00:00Z"));
    // Oct 31, 9pm Eastern is already Nov 1 in UTC -- still October locally.
    expect(monthOf(new Date("2026-11-01T01:00:00Z"), months)).toBe("2026-10");
    expect(monthOf(new Date("2026-11-01T05:00:00Z"), months)).toBe("2026-11");
    expect(monthOf(new Date("2026-06-01T00:00:00Z"), months)).toBeNull();
  });
});

describe("computeMonthlyLeaderboard", () => {
  const members = new Set(["ann", "bo", "cy", "di"]);

  it("ranks qualified members by win %, then average point difference", () => {
    const games = [
      match(["ann", "bo"], ["cy", "di"], 11, 5),
      match(["ann", "cy"], ["bo", "di"], 11, 9),
      match(["ann", "di"], ["bo", "cy"], 7, 11),
    ];
    const { ranked, unranked } = computeMonthlyLeaderboard(games, members, 3);
    // Ann, Bo, and Cy all go 2-1; Bo's point difference (+8) beats Ann's (+4) and Cy's (0).
    expect(ranked.map((entry) => entry.userId)).toEqual(["bo", "ann", "cy", "di"]);
    expect(ranked[0]).toMatchObject({ rank: 1, matches: 3, wins: 2, losses: 1, differential: 8, avgPointDiff: 2.7 });
    expect(ranked[1]).toMatchObject({ rank: 2, userId: "ann", differential: 4, avgPointDiff: 1.3 });
    expect(unranked).toEqual([]);
  });

  it("lists players under the minimum separately and ignores non-members", () => {
    const games = [match(["ann", "bo"], ["cy", "guest"], 11, 2), match(["ann", "bo"], ["cy", "di"], 11, 3)];
    const { ranked, unranked } = computeMonthlyLeaderboard(games, members, 2);
    expect(ranked.map((entry) => entry.userId)).toEqual(["ann", "bo", "cy"]);
    expect(unranked.map((entry) => entry.userId)).toEqual(["di"]);
    expect([...ranked, ...unranked].some((entry) => entry.userId === "guest")).toBe(false);
  });

  it("is empty for a month with no games", () => {
    expect(computeMonthlyLeaderboard([], members)).toEqual({ ranked: [], unranked: [] });
  });
});
