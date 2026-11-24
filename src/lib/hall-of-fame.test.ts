import { describe, expect, it } from "vitest";
import { computeHallOfFame, topDuoStreaks, topPickleDuos, topWinStreaks, type HallOfFameRoundRobin } from "./hall-of-fame";

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

  it("has no Pickle Jar until someone wins 11-0, then fills it", () => {
    expect(records.pickles).toBeUndefined();
    const pickled = Object.fromEntries(computeHallOfFame([...history, night("3", 15, game(["ann", "cy"], ["bo", "dee"], 11, 0), game(["ann", "dee"], ["bo", "cy"], 11, 0))]).map((record) => [record.key, record]));
    expect(pickled.pickles).toMatchObject({ label: "Pickle Jar", value: "2 pickles" });
    expect(pickled.pickles.holders.map((player) => player.userId)).toEqual(["ann"]);
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

  it("finds the most clutch player once they have enough close games", () => {
    const tight = night("c", 1, game(["ann", "bo"], ["cy", "dee"], 11, 9), game(["ann", "cy"], ["bo", "dee"], 11, 10), game(["ann", "dee"], ["bo", "cy"], 12, 10), game(["bo", "cy"], ["ann", "dee"], 11, 9), game(["ann", "bo"], ["cy", "dee"], 11, 10));
    const clutch = computeHallOfFame([tight]).find((record) => record.key === "clutch");
    expect(clutch).toMatchObject({ value: "80%", holders: [{ userId: "ann" }], detail: "4-1 in games decided by 2 or fewer (5+ games)" });
    expect(computeHallOfFame(history).find((record) => record.key === "clutch")).toBeUndefined();
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

describe("topDuoStreaks", () => {
  it("ranks pairs by their longest run of wins together, top three places", () => {
    const streaks = topDuoStreaks([
      night("a", 1,
        game(["ann", "bo"], ["cy", "dee"], 11, 5), game(["ann", "bo"], ["cy", "dee"], 11, 7), // ann+bo 2
        game(["ann", "cy"], ["bo", "dee"], 11, 9), // a game apart doesn't break ann+bo
        game(["bo", "ann"], ["cy", "dee"], 11, 3), // ann+bo 3
        game(["cy", "dee"], ["ann", "bo"], 11, 8), // cy+dee win, ann+bo's run ends at 3
        game(["cy", "dee"], ["ann", "bo"], 11, 6), // cy+dee 2, still going
        game(["ann", "cy"], ["bo", "dee"], 11, 2), // ann+cy 2, still going
      ),
    ]);
    expect(streaks.map(({ players, streak, rank, ongoing }) => [players.map((player) => player.userId).join("+"), streak, rank, ongoing])).toEqual([
      ["ann+bo", 3, 1, false],
      ["cy+dee", 2, 2, true], // reached 2 first
      ["ann+cy", 2, 2, true],
    ]);
  });

  it("leaves out single wins and guests", () => {
    const streaks = topDuoStreaks([night("g", 1, game(["ann", "guest"], ["cy", "dee"], 11, 4), game(["ann", "guest"], ["cy", "dee"], 11, 4), game(["ann", "bo"], ["cy", "dee"], 11, 4))], new Set(["guest"]));
    expect(streaks).toEqual([]);
  });
});

describe("topWinStreaks", () => {
  it("ranks players by their longest run of wins with any partner, ties sharing a place", () => {
    const streaks = topWinStreaks([
      night("w", 1,
        game(["ann", "bo"], ["cy", "dee"], 11, 5),
        game(["ann", "cy"], ["bo", "dee"], 11, 7), // ann 2, cy's run starts
        game(["ann", "dee"], ["bo", "cy"], 11, 9), // ann 3; cy's run ends at 1, nobody else reaches 2
        game(["bo", "cy"], ["ann", "dee"], 11, 4), // ann's run ends at 3
      ),
    ]);
    expect(streaks.map(({ players, streak, rank, ongoing }) => [players[0].userId, streak, rank, ongoing])).toEqual([["ann", 3, 1, false]]);
  });
});

describe("topPickleDuos", () => {
  it("ranks partners by pickles served together, ties sharing a place, guests left out", () => {
    const nights = [
      night("p1", 1, game(["ann", "bo"], ["cy", "dee"], 11, 0), game(["cy", "dee"], ["ann", "bo"], 11, 0), game(["ann", "bo"], ["cy", "dee"], 11, 0)),
      night("p2", 8, game(["ann", "cy"], ["bo", "dee"], 11, 0), game(["eve", "fay"], ["ann", "bo"], 11, 0), game(["gus", "ann"], ["bo", "cy"], 11, 0), game(["bo", "cy"], ["ann", "dee"], 11, 3)),
    ];
    const places = topPickleDuos(nights, new Set(["gus"]));
    expect(places.map((place) => [place.players.map((player) => player.userId).join("+"), place.pickles, place.rank])).toEqual([["ann+bo", 2, 1], ["cy+dee", 1, 2], ["ann+cy", 1, 2], ["eve+fay", 1, 2]]);
    expect(places[0]).toMatchObject({ roundRobin: { id: "p1" } });
    expect(topPickleDuos([night("q", 1, game(["ann"], ["bo"], 11, 0))])).toEqual([]);
  });
});

describe("topWinStreaks with separate runs", () => {
  it("lets a player's second-best streak place too", () => {
    const wins = (count: number) => Array.from({ length: count }, () => game(["ann", "bo"], ["cy", "dee"], 11, 5));
    const streaks = topWinStreaks([night("s", 1, ...wins(5), game(["cy", "dee"], ["ann", "bo"], 11, 5), ...wins(4), game(["cy", "ann"], ["bo", "dee"], 11, 5))]);
    // ann: 5, then 5 more (the last game she wins too); bo: 5, then 4
    expect(streaks.map(({ players, streak, rank, ongoing }) => [players[0].userId, streak, rank, ongoing])).toEqual([
      ["ann", 5, 1, false],
      ["bo", 5, 1, false],
      ["ann", 5, 1, true],
      ["bo", 4, 4, false], // 4th place makes the 5-place podium
    ]);
  });
});
