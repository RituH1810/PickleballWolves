import { describe, expect, it } from "vitest";
import { finalFromSemis, playoffWinners, seedPlayoffs } from "./playoffs";

const ranked = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"];

describe("seedPlayoffs", () => {
  it("seeds singles: a final, or semis 1 v 4 and 2 v 3", () => {
    expect(seedPlayoffs(ranked, "FINAL", "SINGLES")).toEqual({ stage: "FINAL", matches: [{ teamA: ["p1"], teamB: ["p2"] }] });
    expect(seedPlayoffs(ranked, "SEMIS", "SINGLES")).toEqual({ stage: "SEMIFINAL", matches: [{ teamA: ["p1"], teamB: ["p4"] }, { teamA: ["p2"], teamB: ["p3"] }] });
  });

  it("builds balanced pairs for rotating doubles", () => {
    expect(seedPlayoffs(ranked, "FINAL", "DOUBLES")!.matches).toEqual([{ teamA: ["p1", "p4"], teamB: ["p2", "p3"] }]);
    expect(seedPlayoffs(ranked, "SEMIS", "DOUBLES")!.matches).toEqual([{ teamA: ["p1", "p8"], teamB: ["p4", "p5"] }, { teamA: ["p2", "p7"], teamB: ["p3", "p6"] }]);
  });

  it("keeps fixed partners together, ranked by their best player", () => {
    const teams = [["p5", "p6"], ["p1", "p9"], ["p3", "p4"], ["p2", "p7"]];
    expect(seedPlayoffs(ranked, "SEMIS", "DOUBLES", teams)!.matches).toEqual([{ teamA: ["p1", "p9"], teamB: ["p5", "p6"] }, { teamA: ["p2", "p7"], teamB: ["p3", "p4"] }]);
  });

  it("needs enough players", () => {
    expect(seedPlayoffs(ranked.slice(0, 7), "SEMIS", "DOUBLES")).toBeNull();
    expect(seedPlayoffs(ranked.slice(0, 3), "SEMIS", "SINGLES")).toBeNull();
    expect(seedPlayoffs(ranked.slice(0, 2), "FINAL", "SINGLES")).not.toBeNull();
  });
});

describe("playoff progress", () => {
  const semi = (a: string[], b: string[], sideAScore: number, sideBScore: number) => ({ players: [...a.map((userId) => ({ userId, side: "A" as const })), ...b.map((userId) => ({ userId, side: "B" as const }))], scores: sideAScore || sideBScore ? [{ sideAScore, sideBScore }] : [] });

  it("sends the semifinal winners to the final once both are scored", () => {
    const first = semi(["p1", "p8"], ["p4", "p5"], 9, 11);
    const second = semi(["p2", "p7"], ["p3", "p6"], 11, 6);
    expect(playoffWinners(first)).toEqual(["p4", "p5"]);
    expect(finalFromSemis([first, second])).toEqual({ teamA: ["p4", "p5"], teamB: ["p2", "p7"] });
    expect(finalFromSemis([first, semi(["p2", "p7"], ["p3", "p6"], 0, 0)])).toBeNull();
  });
});
