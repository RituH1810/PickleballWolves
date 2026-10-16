import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl } from "./calendar";

const item = { uid: "rr-1", title: "Lancaster Group - Tuesday Night", start: "2026-10-14T22:00:00.000Z", location: "Northside Courts, Lancaster", url: "https://example.com/round-robin/rr-1" };

describe("buildIcs", () => {
  it("writes a UTC event with a default two-hour duration", () => {
    const ics = buildIcs([item], new Date("2026-10-01T00:00:00Z"));
    expect(ics).toContain("DTSTART:20261014T220000Z");
    expect(ics).toContain("DTEND:20261015T000000Z");
    expect(ics).toContain("DTSTAMP:20261001T000000Z");
    expect(ics).toContain("UID:rr-1@pickleballwolves");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("honors an explicit end time or duration", () => {
    expect(buildIcs([{ ...item, end: "2026-10-14T23:30:00.000Z" }])).toContain("DTEND:20261014T233000Z");
    expect(buildIcs([{ ...item, durationMinutes: 60 }])).toContain("DTEND:20261014T230000Z");
  });

  it("escapes commas, semicolons, and newlines", () => {
    const ics = buildIcs([{ ...item, title: "Doubles; open play", description: "Bring water\nand a paddle" }]);
    expect(ics).toContain("SUMMARY:Doubles\\; open play");
    expect(ics).toContain("LOCATION:Northside Courts\\, Lancaster");
    expect(ics).toContain("Bring water\\nand a paddle");
  });

  it("folds long lines at 75 octets", () => {
    const ics = buildIcs([{ ...item, description: "x".repeat(200) }]);
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    // Unfolding restores the original text.
    expect(ics.replace(/\r\n /g, "")).toContain("x".repeat(200));
  });

  it("writes one VEVENT per item", () => {
    expect(buildIcs([item, { ...item, uid: "rr-2" }]).match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});

describe("googleCalendarUrl", () => {
  it("prefills title, time range, location, and link", () => {
    const url = new URL(googleCalendarUrl(item));
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe(item.title);
    expect(url.searchParams.get("dates")).toBe("20261014T220000Z/20261015T000000Z");
    expect(url.searchParams.get("location")).toBe(item.location);
    expect(url.searchParams.get("details")).toBe(item.url);
  });
});

describe("buildIcs feed", () => {
  it("names the calendar and asks apps to refresh it", () => {
    const ics = buildIcs([item], new Date("2026-10-01T00:00:00Z"), { name: "PickleballWolves -- Arpit", refreshMinutes: 60 });
    expect(ics).toContain("X-WR-CALNAME:PickleballWolves -- Arpit");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT60M");
    expect(ics.indexOf("X-WR-CALNAME")).toBeLessThan(ics.indexOf("BEGIN:VEVENT"));
  });
});
