// The club's local time. The server runs in UTC, so any date or time written into a notification,
// email, or name has to be formatted in this zone explicitly -- otherwise a 6:30 PM game reads as
// 10:30 PM.
export const APP_TIME_ZONE = "America/New_York";

/** "Fri, Oct 23, 6:30 PM EDT" */
export function formatGameTime(date: Date) {
  return date.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: APP_TIME_ZONE });
}
