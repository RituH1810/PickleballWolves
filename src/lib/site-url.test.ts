import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "./site-url";

const cronRequest = new Request("https://pickleballwolves-abc123-team.vercel.app/api/cron/send-reminders");

describe("siteUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prefers the configured site address", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pickleballwolves.com/");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "pickleballwolves.vercel.app");
    expect(siteUrl(cronRequest)).toBe("https://pickleballwolves.com");
  });

  it("uses Vercel's production domain instead of the protected deployment address", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "pickleballwolves.vercel.app");
    expect(siteUrl(cronRequest)).toBe("https://pickleballwolves.vercel.app");
  });

  it("falls back to the request's own address locally", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(siteUrl(new Request("http://localhost:3000/api/x"))).toBe("http://localhost:3000");
  });
});
