import { describe, expect, it } from "vitest";
import { brokenRecords, recordMessage } from "./record-alerts";
import type { HallOfFameRecord } from "./hall-of-fame";
import { computeNicknames, type NicknameMatch } from "./nicknames";
import { computeMonthlyRivalry, type RivalryMonthMatch } from "./monthly-rivalry";
import { ratingStakes } from "./rating";
import { cleanStyle, computeStyleInsights } from "./play-style";
import { onThisDay, pastDays, type MemoryMatch } from "./on-this-day";

const record = (key: HallOfFameRecord["key"], value: string, holder: string): HallOfFameRecord => ({ key, label: key === "streak" ? "Longest win streak" : "Biggest win", value, holders: [{ userId: holder, name: `${holder} Smith` }], detail: "detail", roundRobin: null, at: null });

describe("brokenRecords", () => {
  it("flags only records that went up, not ties, first records or untracked keys", () => {
    const before = [record("streak", "15 games", "sat"), record("biggestWin", "+9", "rak")];
    const after = [record("streak", "16 games", "rak"), record("biggestWin", "+9", "arp"), record("bestNight", "8 wins", "nit")];
    const broken = brokenRecords(before, after);
    expect(broken.map((entry) => entry.record.key)).toEqual(["streak"]);
    expect(recordMessage(broken[0], "Lancaster Group")).toEqual({ title: "🏆 New Lancaster Group record!", body: "rak set a new longest win streak record: 16 games, breaking sat's 15 games." });
  });
});

let hour = 0;
const game = (players: [string[], string[]], a: number, b: number, roundRobinId: string | null = "rr1"): NicknameMatch & RivalryMonthMatch & MemoryMatch => ({
  id: `m${hour}`,
  playedAt: new Date(Date.UTC(2026, 9, 1, hour++)),
  roundRobinId,
  event: roundRobinId ? { id: roundRobinId, name: "Tuesday night" } : null,
  winnerSide: null,
  players: [...players[0].map((userId) => ({ userId, side: "A" as const })), ...players[1].map((userId) => ({ userId, side: "B" as const }))],
  scores: [{ gameNumber: 1, sideAScore: a, sideBScore: b }],
});

describe("computeNicknames", () => {
  it("gives a new player The Rookie and a regular at least Pack Regular", () => {
    expect(computeNicknames({ matches: [game([["me"], ["x"]], 11, 5)], userId: "me" }).map((nickname) => nickname.key)).toEqual(["rookie"]);
    const losing = Array.from({ length: 25 }, () => game([["me"], ["x"]], 2, 11));
    expect(computeNicknames({ matches: losing, userId: "me" }).map((nickname) => nickname.key)).toEqual(["regular"]);
  });

  it("puts rarer nicknames first and shows at most three", () => {
    const matches = Array.from({ length: 30 }, (_, index) => game([["me", `p${index % 12}`], ["x", "y"]], 11, 10, `rr${index % 10}`));
    const keys = computeNicknames({ matches, userId: "me", titles: 4, ratingGain30: 0.3 }).map((nickname) => nickname.key);
    expect(keys).toEqual(["titleHunter", "closer", "risingStar"]);
  });
});

describe("computeMonthlyRivalry", () => {
  it("picks the closest pair with enough meetings, with the last result", () => {
    const matches = [
      game([["a"], ["b"]], 11, 5), game([["b"], ["a"]], 11, 9), game([["a"], ["b"]], 11, 8), game([["b"], ["a"]], 11, 7),
      ...Array.from({ length: 5 }, () => game([["c"], ["d"]], 11, 2)),
    ];
    const rivalry = computeMonthlyRivalry(matches);
    expect(rivalry).toMatchObject({ a: "a", b: "b", aWins: 2, bWins: 2, meetings: 4, last: { winner: "b", score: [11, 7] } });
    expect(computeMonthlyRivalry(matches.slice(0, 3))).toBeNull();
  });
});

describe("ratingStakes", () => {
  it("gains for a win and loses for a loss, more for an underdog's win", () => {
    const even = ratingStakes({ myRating: 3.5, myTeam: [3.5, 3.5], opponents: [3.5, 3.5], matchesPlayed: 100 });
    expect(even.win).toBeGreaterThan(0);
    expect(even.lose).toBeLessThan(0);
    expect(even.win).toBeCloseTo(-even.lose, 3);
    const underdog = ratingStakes({ myRating: 3, myTeam: [3, 3], opponents: [4, 4], matchesPlayed: 100 });
    expect(underdog.win).toBeGreaterThan(even.win);
  });
});

describe("play styles", () => {
  it("keeps only known values", () => {
    expect(cleanStyle({ side: "LEFT", shots: "LOBBER", pace: "" })).toEqual({ side: "LEFT", shots: null, pace: null });
  });

  it("tallies the record with partners of each style", () => {
    const matches = [...Array.from({ length: 4 }, () => game([["me", "dinker"], ["x", "y"]], 11, 5)), game([["me", "dinker"], ["x", "y"]], 5, 11), game([["me", "banger"], ["x", "y"]], 11, 5)];
    const insights = computeStyleInsights(matches, "me", new Map([["dinker", { shots: "DINKER" }], ["banger", { shots: "BANGER" }]]));
    expect(insights).toEqual([{ field: "shots", value: "DINKER", label: "Dinker", wins: 4, losses: 1 }]);
  });
});

describe("onThisDay", () => {
  it("lists the same day in earlier months and skips months without it", () => {
    expect(pastDays("2026-03-31").slice(0, 3).map((day) => day.key)).toEqual(["2026-01-31", "2025-12-31", "2025-10-31"]);
  });

  it("prefers a title, then a first match, then a winning night", () => {
    const night = [game([["me"], ["x"]], 11, 2), game([["me"], ["x"]], 11, 4), game([["me"], ["x"]], 3, 11)].map((match) => ({ ...match, playedAt: new Date("2026-10-01T23:00:00Z") }));
    const base = { today: "2026-11-01", timeZone: "America/New_York", userId: "me" };
    expect(onThisDay({ ...base, matches: night, titles: [] })).toEqual({ when: "A month ago today", text: "You played your first match at Tuesday night 🎉", href: "/round-robin/rr1" });
    expect(onThisDay({ ...base, matches: night, titles: [{ roundRobinId: "rr1", name: "Tuesday night", endedAt: new Date("2026-10-02T01:00:00Z") }] })?.text).toBe("You won Tuesday night 👑");
    const earlier = { ...game([["me"], ["x"]], 11, 2), playedAt: new Date("2026-09-01T23:00:00Z") };
    expect(onThisDay({ ...base, matches: [earlier, ...night], titles: [] })?.text).toBe("You played your first match at Tuesday night 🎉");
    expect(onThisDay({ ...base, matches: [{ ...earlier, playedAt: new Date("2026-08-15T23:00:00Z") }, ...night], titles: [] })).toEqual({ when: "A month ago today", text: "You went 2-1 at Tuesday night 🔥", href: "/round-robin/rr1" });
  });
});
