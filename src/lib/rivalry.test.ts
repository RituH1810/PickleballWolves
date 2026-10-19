import { describe, expect, it } from "vitest";
import { computeRivalry, findTopRival, type RivalryMatch } from "./rivalry";

let day = 0;
function match(a: [string, string], b: [string, string], ...games: [number, number][]): RivalryMatch {
  day += 1;
  return {
    id: `m${day}`,
    playedAt: new Date(2026, 9, day),
    event: "Lancaster Group",
    players: [...a.map((userId) => ({ userId, name: userId.toUpperCase(), side: "A" as const })), ...b.map((userId) => ({ userId, name: userId.toUpperCase(), side: "B" as const }))],
    scores: games.map(([sideAScore, sideBScore]) => ({ sideAScore, sideBScore })),
  };
}

describe("computeRivalry", () => {
  // ann vs bo, oldest first: bo, ann, ann, ann, bo (bo on the other side in the last one).
  const history = [
    match(["ann", "x"], ["bo", "y"], [8, 11]),
    match(["ann", "x"], ["bo", "y"], [11, 2]),
    match(["bo", "y"], ["ann", "x"], [9, 11]),
    match(["ann", "y"], ["bo", "x"], [11, 10]),
    match(["bo", "x"], ["ann", "y"], [11, 6], [11, 9]),
    match(["ann", "bo"], ["x", "y"], [11, 4]), // partners, not a meeting
    match(["ann", "x"], ["cy", "y"], [11, 4]), // bo not playing
  ];
  const rivalry = computeRivalry(history, "ann", "bo");

  it("counts meetings and the record from A's side", () => {
    expect(rivalry).toMatchObject({ played: 5, winsA: 3, winsB: 2 });
    expect(rivalry.together).toEqual({ wins: 1, losses: 0 });
  });

  it("orients every score to player A", () => {
    const last = rivalry.meetings[0];
    expect(last.winner).toBe("b");
    expect(last.games).toEqual([[6, 11], [9, 11]]);
    expect(last.partnersA).toEqual(["Y"]);
    expect(last.partnersB).toEqual(["X"]);
  });

  it("finds streaks, closest match, and biggest wins", () => {
    expect(rivalry.currentStreak).toEqual({ who: "b", length: 1 });
    expect(rivalry.longestStreakA).toBe(3);
    expect(rivalry.longestStreakB).toBe(1);
    expect(rivalry.closest).toMatchObject({ margin: 1, winner: "a" });
    expect(rivalry.biggestWinA).toMatchObject({ margin: 9 });
    expect(rivalry.biggestWinB).toMatchObject({ margin: 7 });
    expect(rivalry.firstMeeting!.getTime()).toBeLessThan(rivalry.lastMeeting!.getTime());
  });

  it("is empty for players who never met", () => {
    expect(computeRivalry(history, "ann", "zed")).toMatchObject({ played: 0, currentStreak: null, closest: null, meetings: [] });
  });
});

describe("findTopRival", () => {
  it("picks the most-faced opponent once they've met enough", () => {
    const games = [
      ...Array.from({ length: 5 }, (_, index) => match(["ann", "x"], ["bo", "y"], index % 2 ? [11, 5] : [5, 11])),
      ...Array.from({ length: 3 }, () => match(["ann", "x"], ["cy", "z"], [11, 3])),
    ];
    expect(findTopRival(games, "ann")).toMatchObject({ userId: "bo", played: 5, wins: 2, losses: 3 });
  });

  it("waits until someone has been faced 5 times", () => {
    expect(findTopRival([match(["ann", "x"], ["bo", "y"], [11, 5])], "ann")).toBeNull();
  });
});
