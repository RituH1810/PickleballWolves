import { describe, expect, it } from "vitest";
import { checkPassword, passwordError } from "./password-rules";
import { generateTempPassword } from "./admin-access";

describe("password rules", () => {
  it("accepts a password with 8+ characters, a capital, a number and a special character", () => {
    expect(passwordError("Pickle#2026")).toBeNull();
    expect(checkPassword("Pickle#2026").every((rule) => rule.met)).toBe(true);
  });

  it("names everything that's missing", () => {
    expect(passwordError("pickle")).toBe("Your password needs 8+ characters, a capital letter, a number and a special character.");
    expect(passwordError("Pickleball1")).toBe("Your password needs a special character.");
    expect(passwordError("Pickle ball 12")).toBe("Your password needs a special character."); // a space isn't a special character
    expect(checkPassword("abc").map((rule) => rule.met)).toEqual([false, false, false, false]);
  });

  it("always makes temporary passwords that meet the standard", () => {
    for (let index = 0; index < 200; index++) expect(passwordError(generateTempPassword())).toBeNull();
  });
});
