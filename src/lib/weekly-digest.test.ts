import { describe, expect, it } from "vitest";
import { isEmptyDigest, renderDigestEmail, type DigestData } from "./weekly-digest";

const SITE = "https://example.com";
const data: DigestData = {
  name: "Arpit Patel",
  upcoming: [
    { name: "Lancaster Group - Oct 19, 2026", when: "Mon, Oct 19, 6:30 PM", path: "/round-robin/a", status: "in" },
    { name: "Lancaster Group - Oct 22, 2026", when: "Thu, Oct 22, 6:30 PM", path: "/round-robin/b", status: "invited" },
  ],
  lastWeek: { wins: 6, losses: 4, ratingChange: -0.31, rating: 3.86 },
  badges: [{ name: "Hot Hand", description: "Win 3 matches in a row." }],
};

describe("renderDigestEmail", () => {
  it("leads with the week's games and last week's record", () => {
    const { subject, html, text } = renderDigestEmail(data, SITE);
    expect(subject).toBe("Your week: 1 game lined up, 6-4 last week");
    expect(html).toContain("Hi Arpit, here's your week.");
    expect(html).toContain(`${SITE}/round-robin/a`);
    expect(html).toContain("You're in");
    expect(html).toContain("Invited -- join?");
    expect(html).toContain("−0.31");
    expect(html).toContain("Hot Hand");
    expect(html).toContain(`${SITE}/notifications/settings`);
    expect(text).toContain("- Lancaster Group - Oct 19, 2026 -- Mon, Oct 19, 6:30 PM (you're in)");
  });

  it("escapes names that come from user input", () => {
    const { html } = renderDigestEmail({ ...data, name: "<b>Eve</b>", upcoming: [{ ...data.upcoming[0], name: "Tom & Jerry's <game>" }] }, SITE);
    expect(html).toContain("Hi &lt;b&gt;Eve&lt;/b&gt;");
    expect(html).toContain("Tom &amp; Jerry's &lt;game&gt;");
    expect(html).not.toContain("<b>Eve</b>");
  });

  it("handles a quiet week", () => {
    const quiet = { ...data, upcoming: [], lastWeek: { wins: 0, losses: 0, ratingChange: null, rating: 3.0 }, badges: [] };
    expect(isEmptyDigest(quiet)).toBe(true);
    expect(isEmptyDigest(data)).toBe(false);
    expect(renderDigestEmail(quiet, SITE).subject).toBe("Your week on PickleballWolves");
  });
});
