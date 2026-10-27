import { describe, expect, it } from "vitest";
import { computeGroupFeed, type FeedInput } from "./group-feed";
import type { HallOfFameRoundRobin } from "./hall-of-fame";

const now = new Date(2026, 9, 27, 12);
const day = (offset: number, hour = 18) => new Date(2026, 9, 27 + offset, hour);
let minute = 0;
function game(a: string[], b: string[], sideAScore: number, sideBScore: number, at = day(-2)) {
  minute += 1;
  return { id: `m${minute}`, playedAt: new Date(at.getTime() + minute * 60_000), players: [...a.map((userId) => ({ userId, name: userId.toUpperCase(), side: "A" as const })), ...b.map((userId) => ({ userId, name: userId.toUpperCase(), side: "B" as const }))], scores: [{ gameNumber: 1, sideAScore, sideBScore }] };
}
const members = new Map([["ann", "ANN"], ["bo", "BO"], ["cy", "CY"], ["dee", "DEE"]]);
const input = (overrides: Partial<FeedInput>): FeedInput => ({ roundRobins: [], ratingRows: [], unlocks: [], playersOfTheWeek: [], joins: [], members, now, ...overrides });
const texts = (feed: ReturnType<typeof computeGroupFeed>) => feed.map((item) => item.text);

describe("computeGroupFeed", () => {
  it("announces round robin champions with a link", () => {
    const night: HallOfFameRoundRobin = { id: "rr1", name: "Tuesday Night", endedAt: day(-1, 21), matches: [game(["ann", "bo"], ["cy", "dee"], 11, 4), game(["ann", "cy"], ["bo", "dee"], 11, 9)] };
    expect(computeGroupFeed(input({ roundRobins: [night] }))).toContainEqual(expect.objectContaining({ id: "champion:rr1", text: "ANN won Tuesday Night (2-0)", href: "/round-robin/rr1" }));
  });

  it("calls out a win streak once as a record, then at every fifth win", () => {
    const wins = Array.from({ length: 10 }, () => game(["ann"], ["cy"], 11, 5));
    const feed = computeGroupFeed(input({ roundRobins: [{ id: "rr", name: "Night", endedAt: day(-1), matches: wins }] }));
    expect(texts(feed).filter((text) => text.includes("in a row"))).toEqual(["ANN won 10 games in a row", "New group record: ANN has won 5 games in a row"]);
  });

  it("marks games milestones and the first time a rating milestone is reached", () => {
    const many = Array.from({ length: 25 }, () => game(["ann"], ["bo"], 11, 9));
    const feed = computeGroupFeed(input({
      roundRobins: [{ id: "rr", name: "Night", endedAt: day(-1), matches: many }],
      ratingRows: [
        { userId: "cy", ratingBefore: 3.9, ratingAfter: 4.02, createdAt: day(-5) },
        { userId: "cy", ratingBefore: 4.02, ratingAfter: 3.97, createdAt: day(-4) },
        { userId: "cy", ratingBefore: 3.97, ratingAfter: 4.05, createdAt: day(-3) },
      ],
    }));
    expect(texts(feed)).toEqual(expect.arrayContaining(["ANN played their 25th game in the group", "BO played their 25th game in the group"]));
    expect(texts(feed).filter((text) => text.includes("rating"))).toEqual(["CY reached a 4.0 rating"]);
  });

  it("includes silver and gold badges, Players of the Week and new members, but not bronze badges or non-members", () => {
    const feed = computeGroupFeed(input({
      unlocks: [{ userId: "ann", achievementId: "rr-dynasty", unlockedAt: day(-1) }, { userId: "bo", achievementId: "first-win", unlockedAt: day(-1) }, { userId: "zed", achievementId: "centurion", unlockedAt: day(-1) }],
      playersOfTheWeek: [{ userId: "bo", weekStart: day(-8, 0), createdAt: day(-1, 9) }],
      joins: [{ userId: "dee", joinedAt: day(-3) }],
    }));
    expect(texts(feed)).toEqual(["ANN earned the Dynasty badge", "BO is Player of the Week", "DEE joined the group -- say hi!"]);
  });

  it("keeps only the last 30 days, newest first", () => {
    const feed = computeGroupFeed(input({ joins: [{ userId: "ann", joinedAt: day(-40) }, { userId: "bo", joinedAt: day(-2) }, { userId: "cy", joinedAt: day(-1) }] }));
    expect(feed.map((item) => item.id)).toEqual(["joined:cy", "joined:bo"]);
  });
});
