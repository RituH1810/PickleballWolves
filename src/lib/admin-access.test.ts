import { describe, expect, it } from "vitest";
import { EMAIL_PATTERN, generateTempPassword, isAdminEmail, parseAdminEmails } from "./admin-access";

describe("admin emails", () => {
  it("parses the list and matches case-insensitively", () => {
    const admins = parseAdminEmails(" PickleballWolves@gmail.com, second@example.com ,");
    expect(admins).toEqual(["pickleballwolves@gmail.com", "second@example.com"]);
    expect(isAdminEmail("pickleballwolves@GMAIL.com", admins)).toBe(true);
    expect(isAdminEmail("someone@gmail.com", admins)).toBe(false);
    expect(isAdminEmail(null, admins)).toBe(false);
    expect(parseAdminEmails(undefined)).toEqual([]);
  });
});

describe("generateTempPassword", () => {
  it("makes readable, varied passwords", () => {
    const passwords = Array.from({ length: 50 }, generateTempPassword);
    for (const password of passwords) expect(password).toMatch(/^Wolves-[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/);
    expect(new Set(passwords).size).toBe(50);
  });
});

describe("EMAIL_PATTERN", () => {
  it("accepts normal addresses only", () => {
    expect(EMAIL_PATTERN.test("cltpicklebros@gmail.com")).toBe(true);
    expect(EMAIL_PATTERN.test("not an email")).toBe(false);
  });
});
