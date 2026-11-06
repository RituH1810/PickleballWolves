import { describe, expect, it } from "vitest";
import { emptyMixerHistory, mixerHistoryFromMatches, planMixerRound, recordMixerMatches, type MixerMatch } from "./mixer";

// Deterministic random for repeatable tests.
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const pairKey = (a: string, b: string) => [a, b].sort().join("|");

describe("planMixerRound", () => {
  it("pairs the strongest with the weakest and keeps the court even", () => {
    const players = [
      { id: "pro", rating: 4.5 },
      { id: "good", rating: 3.8 },
      { id: "ok", rating: 3.0 },
      { id: "new", rating: 2.5 },
    ];
    const [[teamA, teamB]] = planMixerRound(players, emptyMixerHistory(), seeded(1));
    const proTeam = [teamA, teamB].find((team) => team.includes("pro"))!;
    expect(proTeam).toContain("new");
  });

  it("never repeats a partner over a night while it's still possible", () => {
    const players = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, rating: 2.5 + i * 0.25 }));
    const history = emptyMixerHistory();
    const seen = new Set<string>();
    // With 8 players, 7 rounds is the most possible without a repeat partner.
    for (let round = 0; round < 7; round++) {
      const matches = planMixerRound(players, history, seeded(round + 7));
      for (const [teamA, teamB] of matches) {
        for (const team of [teamA, teamB]) {
          const key = pairKey(team[0], team[1]);
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      }
      recordMixerMatches(history, matches);
    }
  });

  it("uses every player once and leaves out a remainder past a multiple of four", () => {
    const players = Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, rating: 3 }));
    const matches = planMixerRound(players, emptyMixerHistory(), seeded(3));
    const ids = matches.flatMap(([teamA, teamB]) => [...teamA, ...teamB]);
    expect(matches).toHaveLength(2);
    expect(new Set(ids).size).toBe(8);
  });
});

describe("mixerHistoryFromMatches", () => {
  it("counts partners and opponents from doubles matches and skips singles", () => {
    const history = mixerHistoryFromMatches([
      { players: [{ userId: "a", side: "A" }, { userId: "b", side: "A" }, { userId: "c", side: "B" }, { userId: "d", side: "B" }] },
      { players: [{ userId: "a", side: "A" }, { userId: "c", side: "B" }] },
    ]);
    expect(history.partners.get(pairKey("a", "b"))).toBe(1);
    expect(history.partners.get(pairKey("c", "d"))).toBe(1);
    expect(history.opponents.get(pairKey("a", "c"))).toBe(1);
    expect(history.partners.size).toBe(2);
  });

  it("avoids a pair that already partnered earlier in the night", () => {
    const players = ["a", "b", "c", "d"].map((id) => ({ id, rating: 3 }));
    const earlier: MixerMatch[] = [[["a", "b"], ["c", "d"]]];
    const history = emptyMixerHistory();
    recordMixerMatches(history, earlier);
    const [[teamA, teamB]] = planMixerRound(players, history, seeded(5));
    expect([pairKey(teamA[0], teamA[1]), pairKey(teamB[0], teamB[1])]).not.toContain(pairKey("a", "b"));
  });
});
