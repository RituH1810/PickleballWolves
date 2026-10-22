import { describe, expect, it } from "vitest";
import { isGuestPath, isStandalonePath } from "./guest-access";

describe("isGuestPath", () => {
  it("opens the read-only pages", () => {
    for (const path of ["/groups", "/groups/abc", "/players", "/players/abc", "/leaderboards", "/tournaments", "/tournaments/abc", "/leagues/s1", "/ladder", "/rivalry/a/b", "/round-robin/abc", "/t/spring-open", "/brag/x.y", "/login", "/signup"]) {
      expect(isGuestPath(path), path).toBe(true);
    }
  });

  it("keeps personal and create/edit pages behind sign-in", () => {
    for (const path of ["/", "/dashboard", "/profile", "/notifications", "/notifications/settings", "/matches", "/events", "/admin", "/round-robin", "/round-robin/abc/edit", "/tournaments/new", "/groupsx", "/playersearch"]) {
      expect(isGuestPath(path), path).toBe(false);
    }
  });
});

describe("isStandalonePath", () => {
  it("is sign-in and shared pages only", () => {
    expect(isStandalonePath("/login")).toBe(true);
    expect(isStandalonePath("/t/spring-open")).toBe(true);
    expect(isStandalonePath("/groups")).toBe(false);
    expect(isStandalonePath("/round-robin/abc")).toBe(false);
  });
});
