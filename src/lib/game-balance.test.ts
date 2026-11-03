import { describe, expect, it } from "vitest";
import { gameBalance, pickByeUnit } from "./game-balance";

describe("gameBalance", () => {
  it("flags players two or more games behind the busiest, fewest first", () => {
    const balance = gameBalance([
      { userId: "s", name: "Sathish", games: 9 },
      { userId: "r", name: "Rakesh", games: 8 },
      { userId: "m", name: "Mithun", games: 5 },
      { userId: "n", name: "New", games: 0 },
    ]);
    expect(balance).toMatchObject({ most: 9, fewest: 0, uneven: true });
    expect(balance.behind.map((player) => player.name)).toEqual(["New", "Mithun"]);
  });

  it("is even when everyone is within one game", () => {
    expect(gameBalance([{ userId: "a", name: "A", games: 6 }, { userId: "b", name: "B", games: 5 }])).toMatchObject({ uneven: false, behind: [] });
    expect(gameBalance([])).toMatchObject({ uneven: false });
  });
});

describe("pickByeUnit", () => {
  const games = new Map([["a", 4], ["b", 5], ["c", 5], ["d", 3], ["e", 4]]);
  it("sits out whoever has played the most, only when the count is odd", () => {
    expect(["b", "c"]).toContain(pickByeUnit(["a", "b", "c", "d", "e"], (unit) => games.get(unit)!));
    expect(pickByeUnit(["a", "b", "c", "d", "e"], (unit) => games.get(unit)!, () => 0)).toBe("b");
    expect(pickByeUnit(["a", "b"], (unit) => games.get(unit)!)).toBeNull();
  });
});
