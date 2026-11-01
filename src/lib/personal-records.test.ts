import { describe, expect, it } from "vitest";
import { computePersonalRecords, type RecordMatch } from "./personal-records";

let day = 0;
const night = { id: "rr1", name: "Tuesday night" };
const match = (id: string, games: [number, number][], roundRobin: RecordMatch["roundRobin"] = night): RecordMatch => ({
  id,
  playedAt: new Date(Date.UTC(2026, 9, 1, day++)),
  roundRobin,
  winnerSide: null,
  players: [{ userId: "me", side: "A" }, { userId: "them", side: "B" }],
  scores: games.map(([a, b], index) => ({ gameNumber: index + 1, sideAScore: a, sideBScore: b })),
});

describe("computePersonalRecords", () => {
  it("finds the biggest win, best night, longest match and biggest rating jump", () => {
    const records = computePersonalRecords([
      match("a", [[11, 2]]),
      match("b", [[15, 13]]),
      match("c", [[5, 11]]),
      match("d", [[11, 1]], { id: "rr2", name: "Friday" }),
    ], "me", new Map([["a", 0.02], ["b", 0.031], ["c", -0.01]]));
    const byKey = Object.fromEntries(records.map((record) => [record.key, record]));
    expect(byKey.biggestWin).toMatchObject({ value: "+10", detail: "11-1", matchIds: ["d"] });
    expect(byKey.bestNight).toMatchObject({ value: "2", detail: "2-1 at Tuesday night", matchIds: ["a", "b", "c"] });
    expect(byKey.longestMatch).toMatchObject({ value: "28 pts", matchIds: ["b"] });
    expect(byKey.ratingJump).toMatchObject({ value: "+0.031", detail: "From one match, won 15-13", matchIds: ["b"] });
  });

  it("keeps the first match to set a record and leaves out records not set", () => {
    const records = computePersonalRecords([match("a", [[3, 11]], null), match("b", [[4, 11]], null)], "me");
    expect(records.map((record) => record.key)).toEqual(["longestMatch"]);
    expect(records[0].matchIds).toEqual(["b"]);
    expect(computePersonalRecords([], "me")).toEqual([]);
  });
});
