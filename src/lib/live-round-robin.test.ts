import { describe, expect, it } from "vitest";
import { liveSnapshot, type LiveMatch } from "./live-round-robin";

let tick = 0;
function match(roundNumber: number | null, court: number, a: string[], b: string[], score: [number, number] | null, stage: string | null = null): LiveMatch {
  tick += 1;
  return {
    id: `m${tick}`, roundNumber, stage, courtNumber: court, createdAt: new Date(2026, 10, 28, 18, tick),
    players: [...a.map((userId) => ({ userId, name: userId.toUpperCase(), side: "A" as const })), ...b.map((userId) => ({ userId, name: userId.toUpperCase(), side: "B" as const }))],
    scores: score ? [{ gameNumber: 1, sideAScore: score[0], sideBScore: score[1] }] : [],
  };
}

describe("liveSnapshot", () => {
  it("gives the player's place, record, current round and next match", () => {
    const snapshot = liveSnapshot([
      match(1, 1, ["me", "ann"], ["bo", "cy"], [11, 6]),
      match(2, 1, ["me", "bo"], ["ann", "cy"], [8, 11]),
      match(3, 2, ["me", "cy"], ["ann", "bo"], null),
      match(3, 1, ["ann", "dee"], ["bo", "eve"], null),
    ], "me");
    expect(snapshot).toEqual({ place: 2, of: 4, wins: 1, losses: 1, currentRound: 3, nextMatch: { label: "Round 3 · Court 2", partners: ["CY"], opponents: ["ANN", "BO"] } });
  });

  it("counts manual matches in the order they were made, and has no next match when all are scored", () => {
    const snapshot = liveSnapshot([match(null, 1, ["ann"], ["me"], [11, 4]), match(null, 2, ["bo"], ["me"], null)], "me");
    expect(snapshot.nextMatch).toEqual({ label: "Match 2 · Court 2", partners: [], opponents: ["BO"] });
    expect(liveSnapshot([match(1, 1, ["me"], ["ann"], [11, 4])], "me")).toMatchObject({ place: 1, wins: 1, nextMatch: null, currentRound: null });
  });

  it("points at a playoff match once the regular rounds are done", () => {
    const snapshot = liveSnapshot([match(1, 1, ["me"], ["ann"], [11, 4]), match(2, 1, ["me"], ["bo"], null, "FINAL")], "me");
    expect(snapshot.nextMatch?.label).toBe("Final · Court 1");
  });
});
