import { describe, expect, it } from "vitest";
import { computeXp, levelFor, xpForLevel } from "./xp";

describe("levels", () => {
  it("takes 100 more XP for each level than the last", () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
  });

  it("finds the level, title and progress for an XP total", () => {
    expect(levelFor(0)).toMatchObject({ level: 1, title: "Pup", toNext: 100 });
    expect(levelFor(450)).toMatchObject({ level: 3, title: "Scout", intoLevel: 150, levelSize: 300, toNext: 150, progress: 0.5 });
    expect(levelFor(2100)).toMatchObject({ level: 7, title: "Hunter" });
    expect(levelFor(xpForLevel(15))).toMatchObject({ level: 15, title: "Legend" });
  });
});

describe("computeXp", () => {
  const none = { matches: 0, wins: 0, nights: 0, titles: 0, pickles: 0, goodWolfVotes: 0, goodWolfWins: 0, reactionsAt: [], badges: [] };

  it("adds up every source, biggest first", () => {
    const xp = computeXp({ ...none, matches: 20, wins: 12, nights: 4, titles: 1, pickles: 2, goodWolfVotes: 3, goodWolfWins: 1, badges: [{ tier: "bronze" }, { tier: "gold" }] });
    // 200 + 60 + 60 + 30 + 95 + 20 + 25 + 9
    expect(xp.total).toBe(499);
    expect(xp.sources.map((source) => source.id)).toEqual(["matches", "badges", "wins", "nights", "titles", "goodWolfWins", "pickles", "goodWolfVotes"]);
    expect(xp).toMatchObject({ level: 3, title: "Scout" });
  });

  it("caps reaction XP at 5 a day", () => {
    const day = (date: number, count: number) => Array.from({ length: count }, (_, index) => new Date(Date.UTC(2026, 10, date, 12, index)));
    expect(computeXp({ ...none, reactionsAt: [...day(1, 12), ...day(2, 3)] }).total).toBe(8);
  });
});
