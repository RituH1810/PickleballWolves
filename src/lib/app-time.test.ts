import { describe, expect, it } from "vitest";
import { formatGameTime } from "./app-time";

describe("formatGameTime", () => {
  it("shows Eastern time, not the server's UTC", () => {
    expect(formatGameTime(new Date("2026-10-22T22:30:00Z"))).toBe("Thu, Oct 22, 6:30 PM EDT");
    expect(formatGameTime(new Date("2026-12-05T11:30:00Z"))).toBe("Sat, Dec 5, 6:30 AM EST");
  });
});
