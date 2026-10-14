export type CalendarItem = {
  /** Stable per game, so re-importing updates the calendar entry instead of duplicating it. */
  uid: string;
  title: string;
  start: Date | string;
  end?: Date | string | null;
  /** Used when there's no end time. Most sessions run about two hours. */
  durationMinutes?: number;
  location?: string | null;
  description?: string | null;
  url?: string | null;
};

const DEFAULT_DURATION_MINUTES = 120;

function endOf(item: CalendarItem) {
  if (item.end) return new Date(item.end);
  return new Date(new Date(item.start).getTime() + (item.durationMinutes ?? DEFAULT_DURATION_MINUTES) * 60_000);
}

/** 20261014T180000Z -- UTC, so every calendar app shows it in the viewer's own time zone. */
function utcStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// RFC 5545 text escaping.
function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

// RFC 5545 caps lines at 75 octets; longer ones continue on the next line after a space.
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const charSize = new TextEncoder().encode(char).length;
    if (size + charSize > (parts.length ? 74 : 75)) { parts.push(current); current = ""; size = 0; }
    current += char;
    size += charSize;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function details(item: CalendarItem) {
  return [item.description, item.url].filter(Boolean).join("\n\n");
}

export function buildIcs(items: CalendarItem[], now = new Date()) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PickleballWolves//Games//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const item of items) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.uid}@pickleballwolves`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${utcStamp(new Date(item.start))}`,
      `DTEND:${utcStamp(endOf(item))}`,
      `SUMMARY:${escapeText(item.title)}`,
    );
    if (item.location) lines.push(`LOCATION:${escapeText(item.location)}`);
    const description = details(item);
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
    if (item.url) lines.push(`URL:${item.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(item: CalendarItem) {
  const params = new URLSearchParams({ action: "TEMPLATE", text: item.title, dates: `${utcStamp(new Date(item.start))}/${utcStamp(endOf(item))}` });
  if (item.location) params.set("location", item.location);
  const description = details(item);
  if (description) params.set("details", description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
