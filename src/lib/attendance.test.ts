import { describe, expect, it } from "vitest";
import { computeAttendance, type AttendanceGame } from "./attendance";

const TZ = "America/New_York";
const now = new Date("2026-10-23T16:00:00Z"); // Fri Oct 23

function game(id: string, at: string, playedIds: string[], joinedIds: string[] = playedIds): AttendanceGame {
  return { id, at: new Date(at), playedIds, joinedIds };
}

const members = [
  { id: "ann", name: "Ann", joinedAt: null },
  { id: "bo", name: "Bo", joinedAt: null },
  { id: "cy", name: "Cy", joinedAt: new Date("2026-10-10T00:00:00Z") },
  { id: "di", name: "Di", joinedAt: null },
];

const games = [
  game("g1", "2026-09-26T10:30:00Z", ["ann", "bo", "di"]), // Sat 6:30 AM EDT
  game("g2", "2026-09-28T22:30:00Z", ["ann", "bo"], ["ann", "bo", "di"]), // Mon 6:30 PM, Di joined but sat out
  game("g3", "2026-10-03T10:30:00Z", ["ann", "bo", "di", "x"]),
  game("g4", "2026-10-17T10:30:00Z", ["ann", "cy"]),
];

describe("computeAttendance", () => {
  const insights = computeAttendance(games, members, now, TZ);

  it("sums up turnout", () => {
    expect(insights.totals).toEqual({ games: 4, averagePlayers: 2.8, uniquePlayers: 5, activeMembers: 4, members: 4 });
  });

  it("averages each weekday and part of day in local time, busiest first", () => {
    expect(insights.slots).toEqual([
      { label: "Sat morning", games: 3, averagePlayers: 3 },
      { label: "Mon evening", games: 1, averagePlayers: 2 },
    ]);
  });

  it("charts every week, empty ones included", () => {
    expect(insights.weeks.map((week) => [week.start, week.games])).toEqual([["2026-09-21", 1], ["2026-09-28", 2], ["2026-10-05", 0], ["2026-10-12", 1], ["2026-10-19", 0]]);
  });

  it("rates members on games held since they joined, and flags sat-outs", () => {
    const byId = Object.fromEntries(insights.members.map((row) => [row.id, row]));
    expect(byId.ann).toMatchObject({ played: 4, possible: 4, rate: 100 });
    expect(byId.cy).toMatchObject({ played: 1, possible: 1, rate: 100 });
    expect(byId.di).toMatchObject({ played: 2, possible: 4, rate: 50, joinedButSatOut: 1 });
  });

  it("counts from a member's first game when they joined the group after already playing", () => {
    const late = computeAttendance(games, [{ id: "bo", name: "Bo", joinedAt: new Date("2026-10-20T00:00:00Z") }], now, TZ);
    expect(late.members[0]).toMatchObject({ played: 3, possible: 4, rate: 75 });
  });

  it("spots regulars drifting away after three weeks", () => {
    // Bo and Di last played Oct 3: 20 days before "now" isn't long enough yet; 23 days is.
    expect(insights.fading).toEqual([]);
    const later = computeAttendance(games, members, new Date("2026-10-26T16:00:00Z"), TZ);
    expect(later.fading.map((row) => row.id).sort()).toEqual(["bo", "di"]);
    expect(later.notYet).toEqual([]);
  });
});
