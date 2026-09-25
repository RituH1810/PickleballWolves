import { Resend } from "resend";

export function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export const REMINDER_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "PickleballWolves <reminders@pickleballwolves.com>";
