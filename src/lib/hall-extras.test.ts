import { describe, expect, it } from "vitest";
import { computeHallOfFame, type HallOfFameRoundRobin } from "./hall-of-fame";
import { hallOfGrit, milestoneClubs, playerHallStats, recordChases, recordHistory, yourPlace } from "./hall-extras";

let hour = 0;
const names: Record<string, string> = { a: "Arpit P", b: "Bina Q", c: "Chen R", d: "Dev S", g: "Guest" };
// A singles game from player `x`'s side.
const game = (x: string, y: string, scoreX: number, scoreY: number) => ({
  id: `m${hour}`,
  playedAt: new Date(Date.UTC(2026, 9, 1, hour++)),
  players: [{ userId: x, name: names[x], side: "A" as const }, { userId: y, name: names[y], side: "B" as const }],
  scores: [{ gameNumber: 1, sideAScore: scoreX, sideBScore: scoreY }],
});
const night = (id: string, day: number, matches: ReturnType<typeof game>[]): HallOfFameRoundRobin => ({ id, name: `Night ${id}`, endedAt: new Date(Date.UTC(2026, 9, day, 23)), matches });

const nights = [
  night("1", 1, [game("a", "b", 11, 5), game("a", "c", 11, 3), game("a", "b", 11, 9)]),
  night("2", 2, [game("b", "a", 11, 2), game("b", "c", 11, 4), game("b", "a", 11, 6), game("b", "c", 11, 1)]),
  night("3", 3, [game("a", "c", 11, 10), game("c", "b", 13, 11), game("a", "b", 11, 7)]),
];

describe("playerHallStats", () => {
  it("tallies games, streaks, nights, titles and close losses per member", () => {
    const stats = playerHallStats(nights);
    expect(stats.get("b")).toMatchObject({ games: 8, wins: 4, nights: 3, titles: 1, bestStreak: 4, currentStreak: 0, biggestWin: 10, bestNight: 4, undefeated: 1, closeLosses: 2, mostGamesNight: 4 });
    expect(stats.get("a")).toMatchObject({ titles: 2, currentStreak: 2, undefeated: 1 });
  });
});

describe("recordHistory", () => {
  it("notes each night the record went up", () => {
    const history = recordHistory(nights);
    expect(history.streak.map((reign) => `${reign.holders.map((holder) => holder.userId).join("")} ${reign.value}`)).toEqual(["a 3 games", "b 4 games"]);
    expect(history.streak[1].roundRobin.id).toBe("2");
  });
});

describe("recordChases", () => {
  it("flags a live streak at half the record or more, and one-off-the-record titles", () => {
    const stats = playerHallStats(nights);
    const records = computeHallOfFame(nights);
    stats.get("c")!.currentStreak = 3;
    const texts = recordChases(stats, records).map((chase) => chase.text);
    expect(texts).toContain("Chen has won 3 in a row -- 1 away from Bina's 4");
    expect(texts).toContain("Bina is one title away from tying the record (2)");
  });
});

describe("yourPlace", () => {
  it("ranks the member on each record they have a value for", () => {
    const place = yourPlace(playerHallStats(nights), "b");
    expect(place.find((placing) => placing.key === "bestStreak")).toMatchObject({ rank: 1, of: 3, tied: 0, value: "4 games" });
    expect(place.find((placing) => placing.key === "titles")).toMatchObject({ rank: 2, of: 2 });
    expect(yourPlace(playerHallStats(nights), "nobody")).toEqual([]);
  });
});

describe("milestoneClubs and hallOfGrit", () => {
  it("has no club members for a small group and finds the grit records", () => {
    expect(milestoneClubs(nights).every((club) => club.members.length === 0)).toBe(true);
    const grit = hallOfGrit(nights, playerHallStats(nights));
    expect(grit.find((record) => record.key === "longest")).toMatchObject({ value: "13-11" });
    expect(grit.find((record) => record.key === "marathon")?.value).toBe("4");
  });

  it("dates a club entry to the game that got the player in", () => {
    const many = night("x", 5, Array.from({ length: 100 }, () => game("a", "g", 11, 5)));
    const clubs = milestoneClubs([many], new Set(["g"]));
    const games = clubs.find((club) => club.key === "games100")!;
    expect(games.members.map((member) => member.userId)).toEqual(["a"]);
    expect(games.members[0].joinedAt).toEqual(many.matches[99].playedAt);
  });
});
