import { describe, expect, it } from "vitest";
import { upcomingCutoff } from "./upcoming";

describe("upcomingCutoff", () => {
  it("keeps a 6:30pm Eastern game visible after 8pm Eastern (midnight UTC)", () => {
    const game = new Date("2026-10-15T22:30:00Z"); // Thu 6:30pm EDT
    const lateThatEvening = new Date("2026-10-16T01:15:00Z"); // Thu 9:15pm EDT
    expect(game >= upcomingCutoff(lateThatEvening)).toBe(true);
  });

  it("still keeps the whole UTC day for morning lookups", () => {
    expect(upcomingCutoff(new Date("2026-10-16T15:00:00Z")).toISOString()).toBe("2026-10-16T00:00:00.000Z");
  });

  it("drops a game once it's more than 12 hours old and on a previous day", () => {
    const game = new Date("2026-10-15T22:30:00Z");
    expect(game >= upcomingCutoff(new Date("2026-10-16T11:00:00Z"))).toBe(false);
  });
});
