import { describe, expect, it } from "vitest";
import { isReactionEmoji, playerOfTheWeekTarget, reactionGroupId, recordTarget, summarizeReactions } from "./reactions";

describe("reactions", () => {
  it("summarizes by emoji in display order, oldest reactor first", () => {
    const at = (minute: number) => new Date(2026, 9, 27, 18, minute);
    const rows = [
      { userId: "bo", emoji: "👏", createdAt: at(3) },
      { userId: "ann", emoji: "🔥", createdAt: at(2) },
      { userId: "cy", emoji: "👏", createdAt: at(1) },
      { userId: "ann", emoji: "👏", createdAt: at(4) },
    ];
    const names = new Map([["ann", "Ann"], ["bo", "Bo"], ["cy", "Cy"]]);
    expect(summarizeReactions(rows, names, "ann")).toEqual([
      { emoji: "🔥", count: 1, mine: true, names: ["Ann"] },
      { emoji: "👏", count: 3, mine: true, names: ["Cy", "Bo", "Ann"] },
    ]);
    expect(summarizeReactions(rows, names, null).every((entry) => !entry.mine)).toBe(true);
  });

  it("builds target ids that name their group", () => {
    const record = recordTarget("g1", { key: "streak", value: "5 games", holders: [{ userId: "bo" }, { userId: "ann" }] });
    expect(record).toBe("g1:streak:5 games:ann,bo");
    expect(reactionGroupId("RECORD", record)).toBe("g1");
    expect(reactionGroupId("PLAYER_OF_THE_WEEK", playerOfTheWeekTarget("g2", "2026-10-19T04:00:00.000Z"))).toBe("g2");
    expect(reactionGroupId("ROUND_ROBIN", "rr1")).toBeNull();
  });

  it("only accepts the offered emoji", () => {
    expect(isReactionEmoji("🔥")).toBe(true);
    expect(isReactionEmoji("💩")).toBe(false);
  });
});
