import { describe, expect, it } from "vitest";
import { computeMonthlyReport, reportMessage, type ReportMatch } from "./monthly-report";

let day = 1;
const match = (partner: string, mine: number, theirs: number): ReportMatch => ({
  id: `m${day}`,
  playedAt: new Date(Date.UTC(2026, 9, day++, 18)),
  winnerSide: null,
  players: [{ userId: "me", name: "Me Player", side: "A" }, { userId: partner, name: `${partner} Smith`, side: "A" }, { userId: "x", name: "Xavier Q", side: "B" }, { userId: "y", name: "Yuki R", side: "B" }],
  scores: [{ gameNumber: 1, sideAScore: mine, sideBScore: theirs }],
});
const timeZone = "America/New_York";

describe("computeMonthlyReport", () => {
  it("sums the month and picks the best partner and moment", () => {
    const report = computeMonthlyReport({
      userId: "me",
      matches: [match("ann", 11, 5), match("ann", 11, 9), match("bo", 11, 2), match("bo", 4, 11)],
      ratingRows: [{ ratingDelta: 0.02, ratingAfter: 2.52, createdAt: new Date(1) }, { ratingDelta: -0.005, ratingAfter: 2.515, createdAt: new Date(2) }],
      titles: [],
      timeZone,
    })!;
    expect(report).toMatchObject({ matches: 4, wins: 3, losses: 1, ratingChange: 0.015, ratingNow: 2.515, bestPartner: { name: "ann Smith", wins: 2, losses: 0 } });
    expect(report.bestMoment).toBe("beat Xavier & Yuki 11-2 on Oct 3");
    expect(reportMessage(report, "October")).toEqual({ title: "Your October report card", body: "4 matches, 3-1 · rating +0.015 to 2.515 · best partner ann (2-0) · best moment: you beat Xavier & Yuki 11-2 on Oct 3" });
  });

  it("prefers a title as the best moment and is null without matches", () => {
    expect(computeMonthlyReport({ userId: "me", matches: [match("ann", 3, 11)], ratingRows: [], titles: ["Tuesday night"], timeZone })!.bestMoment).toBe("won Tuesday night");
    expect(computeMonthlyReport({ userId: "me", matches: [], ratingRows: [], titles: [], timeZone })).toBeNull();
  });
});
