import { describe, expect, it } from "vitest";
import { computeHallOfFame, type HallOfFameRoundRobin } from "./hall-of-fame";

let minute = 0;
function game(a: string[], b: string[], sideAScore: number, sideBScore: number) {
  minute += 1;
  return {
    id: `m${minute}`,
    playedAt: new Date(2026, 9, 1, 18, minute),
    players: [...a.map((userId) => ({ userId, name: userId.toUpperCase(), side: "A" as const })), ...b.map((userId) => ({ userId, name: userId.toUpperCase(), side: "B" as const }))],
    scores: [{ gameNumber: 1, sideAScore, sideBScore }],
  };
}
const night = (id: string, day: number, ...matches: ReturnType<typeof game>[]): HallOfFameRoundRobin => ({ id, name: `Night ${id}`, endedAt: new Date(2026, 9, day, 21), matches });

describe("computeHallOfFame", () => {
  const history = [
    // ann & bo win all 3; cy & dee lose all 3
    night("1", 1, game(["ann", "bo"], ["cy", "dee"], 11, 2), game(["ann", "bo"], ["cy", "dee"], 11, 9), game(["cy", "dee"], ["ann", "bo"], 5, 11)),
    // ann & bo win twice more, then lose to cy & dee
    night("2", 8, game(["ann", "bo"], ["cy", "dee"], 11, 7), game(["ann", "bo"], ["cy", "dee"], 11, 8), game(["ann", "bo"], ["cy", "dee"], 6, 11), game(["ann", "bo"], ["cy", "dee"], 10, 10)),
  ];
  const records = Object.fromEntries(computeHallOfFame(history).map((record) => [record.key, record]));
  const holders = (key: string) => records[key].holders.map((player) => player.userId);

  it("counts titles, shared between co-champions", () => {
    expect(records.titles).toMatchObject({ value: "2 titles" });
    expect(holders("titles")).toEqual(expect.arrayContaining(["ann", "bo"]));
  });

  it("finds the longest win streak across nights", () => {
    expect(records.streak).toMatchObject({ value: "5 games" });
    expect(holders("streak")).toEqual(["ann", "bo"]);
  });

  it("keeps the first game to reach the biggest margin", () => {
    expect(records.biggestWin).toMatchObject({ value: "+9", detail: "11-2 over CY & DEE", roundRobin: { id: "1" } });
  });

  it("picks the best single night, then the undefeated nights and the best duo", () => {
    expect(records.bestNight).toMatchObject({ value: "3 wins", detail: "3-0, +17", roundRobin: { id: "1" } });
    expect(records.undefeated).toMatchObject({ value: "1 night" });
    expect(records.duo).toMatchObject({ value: "83%", detail: "5-1 together (5+ games)" });
    expect(holders("duo")).toEqual(["ann", "bo"]);
  });

  it("counts games played, skipping ties", () => {
    expect(records.games).toMatchObject({ value: "6" });
    expect(holders("games")).toHaveLength(4);
  });

  it("never gives a record to a guest", () => {
    const guestRecords = computeHallOfFame([night("g", 1, game(["ann", "guest"], ["cy", "dee"], 11, 0), game(["cy", "dee"], ["ann", "guest"], 11, 9))], new Set(["guest"]));
    for (const record of guestRecords) expect(record.holders.map((player) => player.userId)).not.toContain("guest");
    expect(guestRecords.find((record) => record.key === "biggestWin")?.holders.map((player) => player.userId)).toEqual(["ann"]);
    expect(guestRecords.find((record) => record.key === "duo")).toBeUndefined();
  });

  it("is empty before anything is scored", () => {
    expect(computeHallOfFame([night("e", 1)])).toEqual([]);
  });
});
