/** How long after its start time an open game keeps showing up as upcoming. */
export const STILL_UPCOMING_HOURS = 12;

/**
 * Earliest scheduledAt that still counts as "upcoming" for SETUP/LIVE games: the start of the
 * current UTC day, or STILL_UPCOMING_HOURS ago -- whichever is earlier. The UTC day alone ends at
 * 8pm Eastern, which hid evening games from the dashboard while they were still being played.
 */
export function upcomingCutoff(now = new Date()) {
  const startOfUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(Math.min(startOfUtcDay, now.getTime() - STILL_UPCOMING_HOURS * 3_600_000));
}
