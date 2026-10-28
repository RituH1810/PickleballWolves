import { describe, expect, it } from "vitest";
import { headToHead, recentForm, type FormMatch } from "./form";

let day = 0;
function match(a: string[], b: string[], sideAScore: number, sideBScore: number): FormMatch {
  day += 1;
  return { playedAt: new Date(2026, 9, day), players: [...a.map((userId) => ({ userId, side: "A" as const })), ...b.map((userId) => ({ userId, side: "B" as const }))], scores: [{ sideAScore, sideBScore }] };
}

describe("recentForm", () => {
  it("lists the last five results newest first, with the current run", () => {
    const history = [
      match(["ann"], ["bo"], 11, 4), // W
      match(["ann"], ["bo"], 3, 11), // L
      match(["bo"], ["ann"], 9, 11), // W
      match(["ann"], ["bo"], 10, 10), // level, skipped
      match(["ann", "cy"], ["bo", "dee"], 6, 11), // L
      match(["ann"], ["cy"], 11, 8), // W
      match(["ann"], ["cy"], 11, 2), // W
      match(["bo"], ["cy"], 11, 2), // not ann's
    ];
    expect(recentForm(history, "ann")).toEqual({ results: ["W", "W", "L", "W", "L"], streak: { result: "W", length: 2 } });
  });

  it("has no form before any decided match", () => {
    expect(recentForm([match(["ann"], ["bo"], 5, 5)], "ann")).toEqual({ results: [], streak: null });
  });
});

describe("headToHead", () => {
  it("splits the record against and with another player", () => {
    const history = [
      match(["ann"], ["bo"], 11, 4),
      match(["bo", "x"], ["ann", "y"], 11, 9),
      match(["ann", "bo"], ["x", "y"], 11, 7),
      match(["ann", "cy"], ["x", "y"], 11, 7),
    ];
    expect(headToHead(history, "ann", "bo")).toEqual({ against: { wins: 1, losses: 1 }, together: { wins: 1, losses: 0 } });
  });
});
