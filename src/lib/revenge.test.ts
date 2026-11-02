import { describe, expect, it } from "vitest";
import { findRematches, revengeMessage, type RevengeHistoryMatch } from "./revenge";

let hour = 0;
const played = (id: string, sideA: string[], sideB: string[], a: number, b: number): RevengeHistoryMatch => ({
  id,
  playedAt: new Date(Date.UTC(2026, 9, 1, hour++)),
  winnerSide: null,
  players: [...sideA.map((userId) => ({ userId, side: "A" as const })), ...sideB.map((userId) => ({ userId, side: "B" as const }))],
  scores: [{ gameNumber: 1, sideAScore: a, sideBScore: b }],
});
const upcoming = (id: string, sideA: string[], sideB: string[]) => ({ id, players: [...sideA.map((userId) => ({ userId, side: "A" as const })), ...sideB.map((userId) => ({ userId, side: "B" as const }))] });
const names = new Map([["avi", "Avinash M"], ["prem", "Prem K"], ["sat", "sathish"], ["nit", "Nitin"]]);

describe("findRematches", () => {
  it("flags opponents who won the last meeting, with the record and last score", () => {
    const history = [
      played("0", ["avi", "prem"], ["me", "x"], 11, 9),
      played("1", ["me", "x"], ["avi", "prem"], 11, 6),
      played("2", ["prem", "avi"], ["me", "y"], 11, 8),
      played("3", ["me", "z"], ["sat", "nit"], 4, 11),
      played("4", ["sat", "nit"], ["me", "x"], 9, 11),
    ];
    const rematches = findRematches([upcoming("u1", ["me", "q"], ["avi", "prem"]), upcoming("u2", ["sat", "nit"], ["me", "q"])], history, "me");
    expect(rematches).toEqual([{ matchId: "u1", opponentIds: ["avi", "prem"], wins: 1, losses: 2, lastScore: [8, 11] }]);
  });

  it("ignores new opponents, partial matches of a pair, repeats of the same pair, and pairs they lead", () => {
    const history = [
      played("1", ["avi", "prem"], ["me", "x"], 11, 2),
      played("2", ["avi", "sat"], ["me", "x"], 11, 2),
      played("3", ["me", "x"], ["sat", "nit"], 11, 2),
      played("4", ["me", "y"], ["sat", "nit"], 11, 5),
      played("5", ["sat", "nit"], ["me", "x"], 11, 9),
    ];
    const rematches = findRematches([upcoming("u1", ["me", "x"], ["avi", "nit"]), upcoming("u2", ["me", "y"], ["prem", "avi"]), upcoming("u3", ["avi", "prem"], ["me", "x"]), upcoming("u4", ["sat", "nit"], ["me", "q"])], history, "me");
    expect(rematches.map((rematch) => rematch.matchId)).toEqual(["u2"]);
  });
});

describe("revengeMessage", () => {
  it("names the opponents and bundles several rematches into one push", () => {
    const one = revengeMessage([{ matchId: "u1", opponentIds: ["avi", "prem"], wins: 1, losses: 3, lastScore: [8, 11] }], names, "Tuesday night");
    expect(one.title).toBe("Rematch vs Avinash & Prem 😤");
    expect(one.body).toContain("beat you 11-8 last time (you're 1-3 against them)");
    const two = revengeMessage([{ matchId: "u1", opponentIds: ["avi", "prem"], wins: 1, losses: 3, lastScore: [8, 11] }, { matchId: "u2", opponentIds: ["sat", "nit"], wins: 0, losses: 2, lastScore: [5, 11] }], names, "Tuesday night");
    expect(two.title).toBe("2 rematches at Tuesday night 😤");
    expect(two.body).toContain("vs Avinash & Prem (1-3), vs sathish & Nitin (0-2)");
  });
});
