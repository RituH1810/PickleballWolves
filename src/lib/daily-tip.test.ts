import { describe, expect, it } from "vitest";
import { computeInsights, GENERAL_TIPS, pickDailyTip, type TipGame, type TipInput } from "./daily-tip";

const NOW = new Date("2026-10-16T12:00:00Z");
const RAKESH = { userId: "r", name: "Rakesh Harsh" };
const SACHIN = { userId: "s", name: "Sachin Shakya" };
const MITHUN = { userId: "m", name: "Mithun Verma" };

let clock = 0;
function game(won: boolean, margin: number, extra: Partial<TipGame> = {}): TipGame {
  clock += 1;
  return { playedAt: new Date(NOW.getTime() - clock * 3_600_000), roundRobinId: null, orderInSession: 0, sessionSize: 1, won, margin, partners: [], opponents: [], ...extra };
}

const base: TipInput = { name: "Arpit Patel", games: [], ratingChange14d: null, lastPlayedAt: NOW, nextGame: null, nearestBadge: null };
const ids = (input: Partial<TipInput>) => computeInsights({ ...base, ...input }, NOW).map((tip) => tip.id);

describe("computeInsights", () => {
  it("has nothing to say about a new player", () => {
    expect(ids({})).toEqual([]);
  });

  it("spots close losses and blowouts", () => {
    expect(ids({ games: [game(false, 1), game(false, 2), game(false, 2), game(true, 4)] })).toEqual(["close-losses"]);
    expect(ids({ games: [game(false, 7), game(false, 9), game(false, 6)] })).toEqual(["blowout-losses"]);
  });

  it("compares partners with enough games together", () => {
    const games = [
      ...Array.from({ length: 4 }, () => game(true, 3, { partners: [RAKESH] })),
      game(false, 3, { partners: [SACHIN] }), game(false, 4, { partners: [SACHIN] }), game(true, 3, { partners: [SACHIN] }), game(false, 5, { partners: [SACHIN] }),
    ];
    const tip = computeInsights({ ...base, games }, NOW).find((entry) => entry.id === "partner-gap");
    expect(tip?.title).toBe("4-0 with Rakesh Harsh, 1-3 with Sachin Shakya");
  });

  it("names a tough opponent", () => {
    const games = [game(false, 3, { opponents: [MITHUN] }), game(false, 4, { opponents: [MITHUN] }), game(false, 4, { opponents: [MITHUN] }), game(true, 2, { opponents: [MITHUN] })];
    expect(computeInsights({ ...base, games }, NOW).find((tip) => tip.id === "nemesis")?.title).toBe("Mithun Verma has your number: 1-3");
  });

  it("notices fading late in a round robin night", () => {
    const night = (order: number, won: boolean) => game(won, 3, { roundRobinId: "rr", orderInSession: order, sessionSize: 8 });
    const games = [night(0, true), night(1, true), night(2, true), night(3, true), night(4, false), night(5, false), night(6, true), night(7, false)];
    expect(computeInsights({ ...base, games }, NOW).find((tip) => tip.id === "late-fade")?.title).toBe("You win 100% early in the night, 25% late");
  });

  it("reacts to rating trends, streaks, inactivity, and a close badge", () => {
    expect(ids({ ratingChange14d: -0.31 })).toEqual(["rating-down"]);
    expect(ids({ ratingChange14d: 0.25 })).toEqual(["rating-up"]);
    expect(ids({ games: [game(true, 3), game(true, 3), game(true, 3), game(false, 3)] })).toContain("streak");
    expect(ids({ lastPlayedAt: new Date(NOW.getTime() - 14 * 86_400_000), nextGame: { name: "Lancaster Group - Oct 19", when: "Mon 6:30 PM" } })).toEqual(["inactive"]);
    expect(computeInsights({ ...base, nearestBadge: { name: "Pack Leader", description: "Win 25 matches.", remaining: 2, unit: "wins" } }, NOW)[0].title).toBe("2 wins to Pack Leader");
  });
});

describe("pickDailyTip", () => {
  it("falls back to a general tip and changes day to day", () => {
    const today = pickDailyTip([], "2026-10-16");
    const tomorrow = pickDailyTip([], "2026-10-17");
    expect(today.kind).toBe("general");
    expect(today.id).not.toBe(tomorrow.id);
    expect(pickDailyTip([], "2026-10-16")).toEqual(today);
  });

  it("rotates through every insight", () => {
    const insights = computeInsights({ ...base, ratingChange14d: -0.3, games: [game(false, 1), game(false, 1), game(false, 2)] }, NOW);
    const seen = new Set(Array.from({ length: 6 }, (_, day) => pickDailyTip(insights, `2026-10-${String(10 + day).padStart(2, "0")}`).id));
    for (const insight of insights) expect(seen).toContain(insight.id);
    expect(GENERAL_TIPS.length).toBeGreaterThan(10);
  });
});
