import { describe, expect, it } from "vitest";
import { isHexColor, isValidSlug, readableTextColor, slugify, tournamentDates } from "./branding";

describe("slugify", () => {
  it("makes a clean URL slug", () => {
    expect(slugify("Lancaster Fall Classic 2026!")).toBe("lancaster-fall-classic-2026");
    expect(slugify("  Café   Open -- Doubles  ")).toBe("cafe-open-doubles");
    expect(slugify("x".repeat(80))).toHaveLength(60);
  });

  it("produces slugs that validate", () => {
    expect(isValidSlug(slugify("Lancaster Fall Classic"))).toBe(true);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("Has Spaces")).toBe(false);
    expect(isValidSlug("trailing-")).toBe(false);
  });
});

describe("colors", () => {
  it("validates hex colors", () => {
    expect(isHexColor("#d8f24e")).toBe(true);
    expect(isHexColor("#D8F24E")).toBe(true);
    expect(isHexColor("d8f24e")).toBe(false);
    expect(isHexColor("#fff")).toBe(false);
    expect(isHexColor("red")).toBe(false);
  });

  it("picks readable text on the brand color", () => {
    expect(readableTextColor("#d8f24e")).toBe("#0f1712"); // lime -> dark text
    expect(readableTextColor("#0f1712")).toBe("#ffffff"); // near-black -> white text
    expect(readableTextColor("#2f80ed")).toBe("#ffffff"); // blue -> white text
  });
});

describe("tournamentDates", () => {
  it("shows one day or a range in Eastern time", () => {
    expect(tournamentDates("2026-11-07T14:00:00Z")).toBe("Sat, Nov 7");
    expect(tournamentDates("2026-11-07T14:00:00Z", "2026-11-08T20:00:00Z")).toBe("Sat, Nov 7 - Sun, Nov 8");
    expect(tournamentDates("2026-11-07T14:00:00Z", "2026-11-07T22:00:00Z")).toBe("Sat, Nov 7");
  });
});
