export type ScheduleTiming = { daysOfWeek: number[]; timeOfDay: string; timeZone: string };

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** How far ahead each occurrence becomes a real round robin members can RSVP to. */
export const GENERATE_AHEAD_DAYS = 7;

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date/time parts of an instant as seen on a wall clock in timeZone. */
function zonedParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date).map((part) => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second) };
}

/** Milliseconds timeZone is ahead of UTC at this instant (negative west of Greenwich). */
function offsetAt(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * The instant a wall-clock time happens in timeZone. Re-checks the offset at the result so dates
 * on the far side of a daylight-saving change land on the right hour.
 */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let utc = wall - offsetAt(new Date(wall), timeZone);
  utc = wall - offsetAt(new Date(utc), timeZone);
  return new Date(utc);
}

/** Every occurrence strictly after `after` and at or before `until`, oldest first. */
export function occurrencesBetween(schedule: ScheduleTiming, after: Date, until: Date) {
  const [hour, minute] = schedule.timeOfDay.split(":").map(Number);
  const start = zonedParts(after, schedule.timeZone);
  const results: Date[] = [];
  // Walk local calendar days; the +1 covers the day `until` falls on in timeZone.
  const days = Math.ceil((until.getTime() - after.getTime()) / 86_400_000) + 1;
  for (let offset = 0; offset <= days; offset += 1) {
    const local = new Date(Date.UTC(start.year, start.month - 1, start.day + offset));
    if (!schedule.daysOfWeek.includes(local.getUTCDay())) continue;
    const at = zonedTimeToUtc(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate(), hour, minute, schedule.timeZone);
    if (at > after && at <= until) results.push(at);
  }
  return results;
}

/** Matches the name a hand-made group round robin gets: "Lancaster Group - Oct 15, 2026". */
export function occurrenceName(groupName: string, at: Date, timeZone: string) {
  return `${groupName} - ${at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone })}`;
}

/** "Mon & Thu at 6:30 PM", or "Every day at ..." */
export function describeSchedule(schedule: ScheduleTiming) {
  const [hour, minute] = schedule.timeOfDay.split(":").map(Number);
  const time = new Date(Date.UTC(2000, 0, 1, hour, minute)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  const days = [...schedule.daysOfWeek].sort((a, b) => a - b);
  const label = days.length === 7 ? "Every day" : days.length === 1 ? `Every ${DAY_LABELS[days[0]]}` : `${days.slice(0, -1).map((day) => DAY_LABELS[day]).join(", ")} & ${DAY_LABELS[days[days.length - 1]]}`;
  return `${label} at ${time}`;
}
