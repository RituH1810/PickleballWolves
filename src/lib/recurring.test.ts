import { describe, expect, it } from "vitest";
import { describeSchedule, occurrenceName, occurrencesBetween, parseScheduleBody, rescheduledTime, zonedTimeToUtc } from "./recurring";

const NY = "America/New_York";

describe("zonedTimeToUtc", () => {
  it("handles both sides of a daylight-saving change", () => {
    // EDT (UTC-4) until Nov 1, 2026; EST (UTC-5) after.
    expect(zonedTimeToUtc(2026, 10, 26, 18, 30, NY).toISOString()).toBe("2026-10-26T22:30:00.000Z");
    expect(zonedTimeToUtc(2026, 11, 2, 18, 30, NY).toISOString()).toBe("2026-11-02T23:30:00.000Z");
  });

  it("works east of UTC", () => {
    expect(zonedTimeToUtc(2026, 10, 14, 7, 0, "Asia/Kolkata").toISOString()).toBe("2026-10-14T01:30:00.000Z");
  });
});

describe("occurrencesBetween", () => {
  const lancaster = { daysOfWeek: [1, 4], timeOfDay: "18:30", timeZone: NY }; // Mon & Thu 6:30pm

  it("lists the next week's games in order", () => {
    // Wed Oct 14, 2026, noon Eastern.
    const after = new Date("2026-10-14T16:00:00Z");
    const until = new Date(after.getTime() + 7 * 86_400_000);
    expect(occurrencesBetween(lancaster, after, until).map((date) => date.toISOString())).toEqual(["2026-10-15T22:30:00.000Z", "2026-10-19T22:30:00.000Z"]);
  });

  it("excludes the boundary it already covered and includes the end boundary", () => {
    const thursday = new Date("2026-10-15T22:30:00Z");
    expect(occurrencesBetween(lancaster, thursday, new Date("2026-10-19T22:30:00Z")).map((date) => date.toISOString())).toEqual(["2026-10-19T22:30:00.000Z"]);
  });

  it("keeps the wall-clock time across the DST change", () => {
    const result = occurrencesBetween(lancaster, new Date("2026-10-28T00:00:00Z"), new Date("2026-11-04T00:00:00Z"));
    expect(result.map((date) => date.toISOString())).toEqual(["2026-10-29T22:30:00.000Z", "2026-11-02T23:30:00.000Z"]);
  });

  it("uses the local day, not the UTC day, for late-evening games", () => {
    // Monday 9pm Eastern is already Tuesday in UTC.
    const result = occurrencesBetween({ daysOfWeek: [1], timeOfDay: "21:00", timeZone: NY }, new Date("2026-10-18T00:00:00Z"), new Date("2026-10-25T00:00:00Z"));
    expect(result.map((date) => date.toISOString())).toEqual(["2026-10-20T01:00:00.000Z"]);
    expect(occurrenceName("Lancaster Group", result[0], NY)).toBe("Lancaster Group - Oct 19, 2026");
  });
});

describe("describeSchedule", () => {
  it("reads naturally", () => {
    expect(describeSchedule({ daysOfWeek: [4, 1], timeOfDay: "18:30", timeZone: NY })).toBe("Mon & Thu at 6:30 PM");
    expect(describeSchedule({ daysOfWeek: [6], timeOfDay: "07:30", timeZone: NY })).toBe("Every Sat at 7:30 AM");
    expect(describeSchedule({ daysOfWeek: [1, 3, 5], timeOfDay: "12:00", timeZone: NY })).toBe("Mon, Wed & Fri at 12:00 PM");
  });
});

describe("rescheduledTime", () => {
  it("moves a game to the new time on the same local date", () => {
    // Sat Oct 24, 6:30pm EDT -> 6:30am the same Saturday.
    expect(rescheduledTime(new Date("2026-10-24T22:30:00Z"), { daysOfWeek: [6], timeOfDay: "06:30", timeZone: NY })?.toISOString()).toBe("2026-10-24T10:30:00.000Z");
  });

  it("uses the right offset after daylight saving ends", () => {
    expect(rescheduledTime(new Date("2026-11-07T22:30:00Z"), { daysOfWeek: [6], timeOfDay: "06:30", timeZone: NY })?.toISOString()).toBe("2026-11-07T11:30:00.000Z");
  });

  it("returns null when the weekday was dropped", () => {
    expect(rescheduledTime(new Date("2026-10-24T22:30:00Z"), { daysOfWeek: [0], timeOfDay: "06:30", timeZone: NY })).toBeNull();
  });

  it("reads the weekday in the schedule's time zone, not UTC", () => {
    // Mon 9pm EDT is Tuesday in UTC; still a Monday game.
    expect(rescheduledTime(new Date("2026-10-20T01:00:00Z"), { daysOfWeek: [1], timeOfDay: "19:00", timeZone: NY })?.toISOString()).toBe("2026-10-19T23:00:00.000Z");
  });
});

describe("parseScheduleBody", () => {
  it("normalizes days and applies defaults", () => {
    expect(parseScheduleBody({ daysOfWeek: [4, 1, 1], timeOfDay: "18:30", courtCount: 2 }, NY)).toEqual({ fields: { daysOfWeek: [1, 4], timeOfDay: "18:30", timeZone: NY, courtCount: 2, playFormat: "DOUBLES", partnerFormat: "ROTATE", pointsToWin: 11, winBy: 1 } });
  });

  it("rejects missing days, bad times, and bad court counts", () => {
    expect(parseScheduleBody({ daysOfWeek: [], timeOfDay: "18:30", courtCount: 1 }, NY)).toHaveProperty("error");
    expect(parseScheduleBody({ daysOfWeek: [1], timeOfDay: "25:00", courtCount: 1 }, NY)).toHaveProperty("error");
    expect(parseScheduleBody({ daysOfWeek: [1], timeOfDay: "18:30", courtCount: 0 }, NY)).toHaveProperty("error");
    expect(parseScheduleBody({ daysOfWeek: [1], timeOfDay: "18:30", courtCount: 1 }, "Not/AZone")).toHaveProperty("error");
  });
});
