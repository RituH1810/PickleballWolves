import { describe, expect, it } from "vitest";
import { hypeBody, isHypeTime, type HypeInput } from "./game-day-hype";

const player = (userId: string, name: string, streak = 0, matches = 30) => ({ userId, name, streak, matches });
const base: HypeInput = { when: "Tonight 6:00 PM", joined: 10, me: player("me", "Rakesh"), others: [], versus: new Map() };

describe("hypeBody", () => {
  it("leads with your own streak, then your closest rivalry", () => {
    const body = hypeBody({ ...base, me: player("me", "Rakesh", 3), others: [player("a", "Arpit"), player("s", "Sathish", 5)], versus: new Map([["a", { wins: 7, losses: 7 }], ["s", { wins: 2, losses: 1 }]]) });
    expect(body).toBe("Tonight 6:00 PM · 10 joined. You're on a 3-win streak 🔥 · you and Arpit are 7-7, settle it tonight");
  });

  it("calls out a milestone you could reach tonight and who's hot", () => {
    const body = hypeBody({ ...base, me: player("me", "Rakesh", 0, 49), others: [player("s", "Sathish", 5), player("n", "Nitin", 3)] });
    expect(body).toBe("Tonight 6:00 PM · 10 joined. Your 50th match could be tonight · Sathish is on a 5-win streak");
  });

  it("frames a losing rivalry as payback and falls back to a plain line", () => {
    expect(hypeBody({ ...base, others: [player("a", "Arpit")], versus: new Map([["a", { wins: 2, losses: 5 }]]) })).toBe("Tonight 6:00 PM · 10 joined. Arpit leads you 5-2, time for payback");
    expect(hypeBody(base)).toBe("Tonight 6:00 PM · 10 joined. See you on the court!");
  });
});

describe("isHypeTime", () => {
  const zone = "America/New_York";
  // Nov 11 2026: 6 PM Eastern is 23:00 UTC.
  const start = new Date("2026-11-11T23:00:00Z");
  it("is on from 9 AM on game day until 2 hours before the start", () => {
    expect(isHypeTime(start, new Date("2026-11-11T13:30:00Z"), zone)).toBe(false); // 8:30 AM
    expect(isHypeTime(start, new Date("2026-11-11T14:00:00Z"), zone)).toBe(true); // 9:00 AM
    expect(isHypeTime(start, new Date("2026-11-11T21:30:00Z"), zone)).toBe(false); // 4:30 PM, too close
    expect(isHypeTime(start, new Date("2026-11-10T15:00:00Z"), zone)).toBe(false); // the day before
  });
});
