import { randomInt } from "node:crypto";

/** ADMIN_EMAILS ("a@x.com, b@y.com") as lowercase addresses. */
export function parseAdminEmails(value: string | undefined) {
  return (value ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

/** Whether this email is on the admin list (case-insensitive). */
export function isAdminEmail(email: string | null | undefined, adminEmails: string[]) {
  return Boolean(email) && adminEmails.includes(email!.trim().toLowerCase());
}

// No 0/O, 1/I/L, or similar look-alikes: these get read out over the phone or typed from a text.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A temporary password like "Wolves-K7QM-3XRT": easy to pass on, ~40 bits of randomness. */
export function generateTempPassword() {
  const block = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `Wolves-${block()}-${block()}`;
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
