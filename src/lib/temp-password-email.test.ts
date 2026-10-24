import { describe, expect, it } from "vitest";
import { renderTempPasswordEmail } from "./temp-password-email";

describe("renderTempPasswordEmail", () => {
  it("includes the password and sign-in link, with the name escaped", () => {
    const email = renderTempPasswordEmail({ name: "Sam <b>", email: "sam@example.com", password: "Wolves-K7QM-3XRT", loginUrl: "https://pickleballwolves.com/login" });
    expect(email.subject).toBe("Your PickleballWolves temporary password");
    expect(email.text).toContain("Temporary password: Wolves-K7QM-3XRT");
    expect(email.text).toContain("Sign in at https://pickleballwolves.com/login");
    expect(email.html).toContain("Wolves-K7QM-3XRT");
    expect(email.html).toContain("Hi Sam &lt;b&gt;,");
    expect(email.html).not.toContain("<b>,");
  });
});
