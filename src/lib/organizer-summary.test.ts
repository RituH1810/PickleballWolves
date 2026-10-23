import { describe, expect, it } from "vitest";
import { buildOrganizerSummary, type SummaryInput } from "./organizer-summary";

const game = (playedIds: string[]) => ({ id: playedIds.join(""), at: new Date("2026-10-19T22:30:00Z"), playedIds, joinedIds: playedIds });
const memberNames = new Map([["a", "Arpit"], ["s", "Sachin"], ["n", "Nitin"], ["m", "Mithun"]]);

function summary(overrides: Partial<SummaryInput>) {
  return buildOrganizerSummary({ groupName: "Lancaster Group", lastWeek: [], baseline: [], memberNames, fadingNames: [], upcoming: [], ...overrides });
}

describe("buildOrganizerSummary", () => {
  it("sums up last week against usual, with the regulars, the drifters, and what's next", () => {
    expect(summary({
      lastWeek: [game(["a", "s", "n", "x"]), game(["a", "s", "n", "m", "x", "y"])],
      baseline: [game(["a", "s"]), game(["a", "s", "n", "m"])],
      fadingNames: ["Raj"],
      upcoming: [{ label: "Mon 6:30 PM", joined: 5 }, { label: "Thu 6:30 PM", joined: 2 }],
    })).toEqual({
      title: "Lancaster Group last week: 2 games, 5 players avg",
      body: "Up from 3 usual\nCame to every game: Arpit, Sachin, Nitin\nDrifting away: Raj\nThis week: Mon 6:30 PM (5 in), Thu 6:30 PM (2 in)",
    });
  });

  it("handles a quiet week and says when nothing is scheduled", () => {
    expect(summary({ fadingNames: ["Raj", "Mithun", "Sanjay", "Prem"], upcoming: [{ label: "Thu 6:30 PM", joined: 0 }] })).toEqual({
      title: "Lancaster Group: no games last week",
      body: "Drifting away: Raj, Mithun, Sanjay +1 more\nThis week: Thu 6:30 PM (0 in)",
    });
    expect(summary({ lastWeek: [game(["a", "s", "n", "m"])], baseline: [game(["a", "s", "n", "m"])] })!.body).toBe("About the same as usual (4)\nNothing scheduled this week yet");
  });

  it("names who played most when nobody made every game", () => {
    const body = summary({ lastWeek: [game(["a", "s"]), game(["a", "n"]), game(["s", "m"])] })!.body;
    expect(body).toBe("Most games: Arpit, Sachin (2)\nNothing scheduled this week yet");
  });

  it("stays quiet with nothing to report", () => {
    expect(summary({ fadingNames: ["Raj"] })).toBeNull();
  });
});
