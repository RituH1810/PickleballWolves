import { describe, expect, it } from "vitest";
import { goodWolfResult } from "./good-wolf";

const ended = new Date(2026, 10, 2, 21);
const hoursLater = (hours: number) => new Date(ended.getTime() + hours * 3_600_000);

describe("goodWolfResult", () => {
  it("keeps the result hidden while voting is open", () => {
    expect(goodWolfResult(["ann", "ann", "bo"], ended, hoursLater(10))).toMatchObject({ open: true, totalVotes: 3, winners: [] });
  });

  it("names the most-voted player once voting closes, ties shared", () => {
    expect(goodWolfResult(["ann", "bo", "ann", "cy"], ended, hoursLater(72)).winners).toEqual([{ userId: "ann", votes: 2 }]);
    expect(goodWolfResult(["ann", "bo", "ann", "bo"], ended, hoursLater(80)).winners).toEqual([{ userId: "ann", votes: 2 }, { userId: "bo", votes: 2 }]);
  });

  it("needs at least two votes to crown anyone", () => {
    expect(goodWolfResult(["ann", "bo"], ended, hoursLater(73)).winners).toEqual([]);
  });
});
