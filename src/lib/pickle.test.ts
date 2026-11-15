import { describe, expect, it } from "vitest";
import { isPickle, pickleLine, pickleTally, pickleWinner } from "./pickle";

describe("pickles", () => {
  it("spots a shutout game on either side", () => {
    expect(pickleWinner({ sideAScore: 11, sideBScore: 0 })).toBe("A");
    expect(pickleWinner({ sideAScore: 0, sideBScore: 15 })).toBe("B");
    expect(pickleWinner({ sideAScore: 11, sideBScore: 1 })).toBeNull();
    expect(pickleWinner({ sideAScore: 0, sideBScore: 0 })).toBeNull();
    expect(isPickle(11, 0)).toBe(true);
    expect(isPickle(0, 11)).toBe(false);
  });

  it("counts pickles served and taken", () => {
    const at = (day: number) => new Date(2026, 10, day);
    const players = [{ userId: "me", side: "A" as const }, { userId: "you", side: "B" as const }];
    const tally = pickleTally([
      { id: "m1", playedAt: at(1), players, scores: [{ sideAScore: 11, sideBScore: 0 }, { sideAScore: 0, sideBScore: 11 }] },
      { id: "m2", playedAt: at(3), players, scores: [{ sideAScore: 11, sideBScore: 0 }] },
      { id: "m3", playedAt: at(2), players, scores: [{ sideAScore: 11, sideBScore: 4 }] },
    ], "me");
    expect(tally).toEqual({ served: 2, taken: 1, servedMatchIds: ["m1", "m2"], lastServedAt: at(3) });
    expect(pickleTally([], "me").served).toBe(0);
  });

  it("describes a pickle", () => {
    expect(pickleLine([{ name: "Asha" }, { name: "Ben" }], [{ name: "Cam" }, { name: "Dee" }], 11)).toBe("Asha & Ben pickled Cam & Dee 11-0");
  });
});
