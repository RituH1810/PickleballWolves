import { describe, expect, it } from "vitest";
import { computeChemistry } from "./chemistry";
import type { HallOfFameRoundRobin } from "./hall-of-fame";

const names: Record<string, string> = { r: "Rakesh", a: "Arpit", n: "Nitin", p: "Prem", g: "Guest" };
let hour = 0;
// One match per call; each [a, b] is a game from team A's side.
const match = (teamA: string[], teamB: string[], ...games: [number, number][]) => ({
  id: `m${hour}`,
  playedAt: new Date(Date.UTC(2026, 9, 1, hour++)),
  players: [...teamA.map((userId) => ({ userId, name: names[userId], side: "A" as const })), ...teamB.map((userId) => ({ userId, name: names[userId], side: "B" as const }))],
  scores: games.map(([sideAScore, sideBScore], index) => ({ gameNumber: index + 1, sideAScore, sideBScore })),
});
const night = (matches: ReturnType<typeof match>[]): HallOfFameRoundRobin => ({ id: "rr", name: "Tuesday", endedAt: new Date(), matches });

describe("computeChemistry", () => {
  it("tallies each pair's games together and ranks the best and worst pairs", () => {
    const matches = [
      ...Array.from({ length: 5 }, () => match(["r", "a"], ["n", "p"], [11, 5])),
      match(["a", "r"], ["p", "n"], [3, 11], [11, 9]),
      match(["r", "n"], ["a", "p"], [11, 7], [11, 4], [5, 11]),
    ];
    const chemistry = computeChemistry([night(matches)]);
    const record = (x: string, y: string) => chemistry.pairs.find((pair) => [pair.a, pair.b].sort().join() === [x, y].sort().join());
    expect(record("r", "a")).toMatchObject({ wins: 6, losses: 1 });
    expect(record("n", "p")).toMatchObject({ wins: 1, losses: 6 });
    expect(record("r", "n")).toMatchObject({ wins: 2, losses: 1 });
    expect(chemistry.best.map((pair) => [pair.a, pair.b].sort().join())).toEqual(["a,r"]);
    expect([chemistry.worst!.a, chemistry.worst!.b].sort()).toEqual(["n", "p"]);
    expect(chemistry.players.map((player) => player.userId)).toEqual(["a", "n", "p", "r"]);
  });

  it("leaves out guests and singles, and has no worst pair when every pair wins", () => {
    const chemistry = computeChemistry([night([match(["r", "g"], ["a", "n"], [11, 2]), match(["r"], ["a"], [11, 2]), ...Array.from({ length: 5 }, () => match(["r", "a"], ["n", "g"], [11, 2]))])], new Set(["g"]));
    expect(chemistry.players.map((player) => player.userId).sort()).toEqual(["a", "n", "r"]);
    expect(chemistry.pairs.map((pair) => [pair.a, pair.b].sort().join()).sort()).toEqual(["a,n", "a,r"]);
    expect(chemistry.worst).toBeNull();
  });
});
