import { describe, expect, it } from "vitest";
import { decodeBragCode, encodeBragCode } from "./brag";

const SECRET = "test-secret";

describe("brag codes", () => {
  it("round-trips both kinds of card", () => {
    const badge = { kind: "achievement", userId: "7f1c-user", achievementId: "rr-five-time" } as const;
    const recap = { kind: "recap", userId: "7f1c-user", roundRobinId: "cm123" } as const;
    expect(decodeBragCode(encodeBragCode(badge, SECRET), SECRET)).toEqual(badge);
    expect(decodeBragCode(encodeBragCode(recap, SECRET), SECRET)).toEqual(recap);
  });

  it("rejects tampered, foreign, and junk codes", () => {
    const code = encodeBragCode({ kind: "achievement", userId: "ann", achievementId: "first-win" }, SECRET);
    const [, sig] = code.split(".");
    const forged = `${Buffer.from("a|bo|first-win").toString("base64url")}.${sig}`;
    expect(decodeBragCode(forged, SECRET)).toBeNull();
    expect(decodeBragCode(code, "other-secret")).toBeNull();
    expect(decodeBragCode("nonsense", SECRET)).toBeNull();
    expect(decodeBragCode(`${code}.x`, SECRET)).toBeNull();
  });
});
