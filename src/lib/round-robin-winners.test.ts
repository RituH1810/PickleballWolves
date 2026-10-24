import { describe, expect, it } from "vitest";
import { rankRoundRobinWinners } from "./round-robin-winners";

const night = (day: number, ...champions: string[]) => ({ endedAt: new Date(2026, 9, day), champions: champions.map((userId) => ({ userId, name: userId.toUpperCase() })) });

describe("rankRoundRobinWinners", () => {
  it("ranks the top three by titles, counting each co-champion", () => {
    const winners = rankRoundRobinWinners([night(1, "ann"), night(2, "ann", "bo"), night(3, "bo"), night(4, "ann"), night(5, "cy"), night(6, "dee", "cy"), night(7, "eve")]);
    expect(winners.map(({ userId, titles, rank }) => [userId, titles, rank])).toEqual([["ann", 3, 1], ["cy", 2, 2], ["bo", 2, 2]]);
    expect(winners[0].lastWonAt).toEqual(new Date(2026, 9, 4));
  });

  it("keeps everyone tied for the last place", () => {
    const winners = rankRoundRobinWinners([night(1, "ann"), night(2, "ann"), night(3, "bo"), night(4, "cy"), night(5, "dee")]);
    expect(winners.map(({ userId, rank }) => [userId, rank])).toEqual([["ann", 1], ["dee", 2], ["cy", 2], ["bo", 2]]);
  });

  it("is empty before any round robin has a champion", () => {
    expect(rankRoundRobinWinners([night(1)])).toEqual([]);
  });
});
