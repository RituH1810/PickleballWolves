import { describe, expect, it } from "vitest";
import { computeAchievements, type AchievementInput, type AchievementMatch } from "./achievements";

const ME = "me";
let clock = 0;

function match(won: boolean, options: Partial<AchievementMatch> & { games?: [number, number][]; partner?: string } = {}): AchievementMatch {
  clock += 1;
  const id = options.id ?? `m${clock}`;
  const games = options.games ?? [won ? [11, 6] : [6, 11]];
  return {
    id,
    playedAt: new Date(2026, 0, 1, 0, clock),
    roundRobinId: options.roundRobinId ?? null,
    winnerSide: won ? "A" : "B",
    players: [{ userId: ME, side: "A" }, ...(options.partner ? [{ userId: options.partner, side: "A" as const }] : []), { userId: `opp-${id}`, side: "B" }],
    scores: games.map(([mine, theirs], index) => ({ gameNumber: index + 1, sideAScore: mine, sideBScore: theirs })),
  };
}

function compute(matches: AchievementMatch[], extra: Partial<AchievementInput> = {}) {
  const result = computeAchievements({ userId: ME, matches, ratingBefore: new Map(), ratingHistory: [], ladderTopAt: null, championAt: null, ...extra });
  return Object.fromEntries(result.map((achievement) => [achievement.id, achievement]));
}

describe("computeAchievements", () => {
  it("gives a new player nothing", () => {
    expect(Object.values(compute([])).filter((achievement) => achievement.unlocked)).toEqual([]);
  });

  it("tracks win streaks and resets them on a loss", () => {
    const matches = [match(true), match(true), match(false), match(true), match(true), match(true)];
    const result = compute(matches);
    expect(result["hot-hand"].unlocked).toBe(true);
    expect(result["hot-hand"].unlockedAt).toEqual(matches[5].playedAt);
    expect(result["on-fire"]).toMatchObject({ unlocked: false, progress: { current: 3, target: 5 } });
  });

  it("orders by playedAt, not input order", () => {
    const matches = [match(true), match(true), match(true)].reverse();
    expect(compute(matches)["first-win"].unlockedAt).toEqual(matches[2].playedAt);
  });

  it("caps progress at the target", () => {
    const result = compute(Array.from({ length: 12 }, () => match(true)));
    expect(result.regular.progress).toEqual({ current: 10, target: 10 });
    expect(result.grinder.progress).toEqual({ current: 12, target: 50 });
  });

  it("awards a comeback only after dropping game one", () => {
    expect(compute([match(true, { games: [[11, 0], [9, 11], [11, 7]] })]).comeback.unlocked).toBe(false);
    expect(compute([match(true, { games: [[8, 11], [11, 9], [11, 7]] })]).comeback.unlocked).toBe(true);
  });

  it("awards a bagel for a shutout game", () => {
    expect(compute([match(false, { games: [[11, 0], [5, 11], [3, 11]] })]).bagel.unlocked).toBe(true);
    expect(compute([match(true, { games: [[11, 1]] })]).bagel.unlocked).toBe(false);
  });

  it("counts distinct partners and round robins", () => {
    const matches = [match(true, { partner: "p1", roundRobinId: "rr1" }), match(true, { partner: "p1", roundRobinId: "rr1" }), match(true, { partner: "p2", roundRobinId: "rr2" })];
    const result = compute(matches);
    expect(result.mixer.progress.current).toBe(2);
    expect(result["round-robin-regular"].progress.current).toBe(2);
  });

  it("awards Giant Slayer only for beating a side rated 0.5+ higher", () => {
    const upset = match(true, { id: "upset" });
    const close = match(true, { id: "close" });
    const ratingBefore = new Map([["upset:me", 3.0], ["upset:opp-upset", 3.5], ["close:me", 3.0], ["close:opp-close", 3.4]]);
    expect(compute([close], { ratingBefore })["giant-slayer"].unlocked).toBe(false);
    expect(compute([upset], { ratingBefore })["giant-slayer"].unlocked).toBe(true);
    // No rating history for the match -- can't judge it.
    expect(compute([match(true)])["giant-slayer"].unlocked).toBe(false);
  });

  it("measures Rising Star from the first recorded rating", () => {
    const ratingHistory = [
      { ratingBefore: 3.0, ratingAfter: 3.2, createdAt: new Date(2026, 0, 1) },
      { ratingBefore: 3.2, ratingAfter: 3.5, createdAt: new Date(2026, 0, 2) },
    ];
    const result = compute([], { ratingHistory });
    expect(result["rising-star"]).toMatchObject({ unlocked: true, unlockedAt: new Date(2026, 0, 2) });
  });

  it("passes through ladder and tournament titles", () => {
    const at = new Date(2026, 5, 1);
    const result = compute([], { ladderTopAt: at, championAt: at });
    expect(result["ladder-king"].unlockedAt).toEqual(at);
    expect(result.champion.unlockedAt).toEqual(at);
  });

  it("counts round robin wins toward the champion badges", () => {
    const wins = Array.from({ length: 5 }, (_, index) => new Date(2026, 5, 5 - index));
    const result = compute([], { roundRobinWins: wins });
    expect(result["rr-champion"].unlockedAt).toEqual(new Date(2026, 5, 1));
    expect(result["rr-five-time"].unlocked).toBe(true);
    expect(result["rr-five-time"].unlockedAt).toEqual(new Date(2026, 5, 5));
    expect(result["rr-dynasty"].unlocked).toBe(false);
    expect(result["rr-dynasty"].progress).toEqual({ current: 5, target: 10 });
  });
});
