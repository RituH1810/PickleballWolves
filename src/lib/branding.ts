/** Brand colors an organizer can pick with one tap (they can also enter any hex color). */
export const BRAND_PRESETS = ["#d8f24e", "#2f80ed", "#e2483d", "#f2994a", "#9b51e0", "#27ae60", "#0f1712", "#f4c430"];
export const DEFAULT_BRAND_COLOR = "#d8f24e";
export const SLUG_MAX = 60;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

/** "Lancaster Fall Classic 2026!" -> "lancaster-fall-classic-2026" */
export function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, SLUG_MAX).replace(/-+$/g, "");
}

export function isValidSlug(value: unknown): value is string {
  return typeof value === "string" && value.length >= 3 && value.length <= SLUG_MAX && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
}

/** Black or white -- whichever reads better on the brand color (WCAG relative luminance). */
export function readableTextColor(hex: string) {
  const channel = (index: number) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.4 ? "#0f1712" : "#ffffff";
}

export function assetUrl(assetId: string | null | undefined) {
  return assetId ? `/api/t-assets/${assetId}` : null;
}

export function publicTournamentPath(slug: string) {
  return `/t/${slug}`;
}

/** "Sat, Nov 7" or "Sat, Nov 7 - Sun, Nov 8" */
export function tournamentDates(start: Date | string, end?: Date | string | null) {
  const format = (value: Date | string) => new Date(value).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });
  const first = format(start);
  const last = end ? format(end) : null;
  return last && last !== first ? `${first} - ${last}` : first;
}
