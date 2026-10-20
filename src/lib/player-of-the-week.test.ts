import { describe, expect, it } from "vitest";
import { pickPlayerOfTheWeek, previousWeek } from "./player-of-the-week";
import type { LeaderboardMatch } from "./monthly-leaderboard";

function match(a: [string, string], b: [string, string], scoreA: number, scoreB: number): LeaderboardMatch {
  return { playedAt: new Date("2026-10-14T22:30:00Z"), players: [...a.map((userId) => ({ userId, side: "A" as const })), ...b.map((userId) => ({ userId, side: "B" as const }))], scores: [{ sideAScore: scoreA, sideBScore: scoreB }] };
}

describe("previousWeek", () => {
  it("is last Monday through Sunday, in Eastern time", () => {
    // Monday Oct 19, 9am EDT.
    const week = previousWeek(new Date("2026-10-19T13:00:00Z"));
    expect(week.start.toISOString()).toBe("2026-10-12T04:00:00.000Z");
    expect(week.end.toISOString()).toBe("2026-10-19T04:00:00.000Z");
    expect(week.label).toBe("Oct 12 - Oct 18");
  });

  it("gives the same week any day of the following week", () => {
    expect(previousWeek(new Date("2026-10-25T03:00:00Z")).label).toBe("Oct 12 - Oct 18"); // Sat Oct 24, 11pm EDT
  });

  it("handles the daylight-saving week", () => {
    const week = previousWeek(new Date("2026-11-09T14:00:00Z"));
    expect(week.start.toISOString()).toBe("2026-11-02T05:00:00.000Z"); // Mon Nov 2, EST
    expect(week.label).toBe("Nov 2 - Nov 8");
  });
});

describe("pickPlayerOfTheWeek", () => {
  const members = new Set(["ann", "bo", "cy", "di"]);

  it("picks the best qualified member", () => {
    const games = [
      match(["ann", "bo"], ["cy", "di"], 11, 5),
      match(["ann", "cy"], ["bo", "di"], 11, 9),
      match(["ann", "di"], ["bo", "cy"], 11, 7),
    ];
    expect(pickPlayerOfTheWeek(games, members, 3).map((entry) => entry.userId)).toEqual(["ann"]);
  });

  it("shares a dead heat and needs enough matches", () => {
    const games = [match(["ann", "bo"], ["cy", "di"], 11, 5), match(["ann", "bo"], ["cy", "di"], 11, 5)];
    expect(pickPlayerOfTheWeek(games, members, 2).map((entry) => entry.userId).sort()).toEqual(["ann", "bo"]);
    expect(pickPlayerOfTheWeek(games, members)).toEqual([]);
  });
});
