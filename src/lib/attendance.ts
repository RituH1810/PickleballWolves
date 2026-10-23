import { zonedParts } from "./recurring";

// Attendance for one group's round robins over a period. "Played" means the player was in at least
// one scored match of that game -- the reliable signal. "Joined" (RSVP'd in) without playing is
// tracked separately as a soft no-show: they may have sat out, but organizers want to see it.

export type AttendanceGame = { id: string; at: Date; playedIds: string[]; joinedIds: string[] };
export type AttendanceMember = { id: string; name: string; joinedAt: Date | null };

// Away this long after coming at least twice in the period counts as drifting away.
export const FADING_DAYS = 21;
export const FADING_MIN_GAMES = 2;

export type MemberAttendance = {
  id: string;
  name: string;
  played: number;
  // Games held since they joined the group or first played (within the period) -- the fair denominator.
  possible: number;
  rate: number; // 0-100
  lastPlayedAt: Date | null;
  joinedButSatOut: number;
};

function weekStart(date: Date, timeZone: string) {
  const local = zonedParts(date, timeZone);
  const day = new Date(Date.UTC(local.year, local.month - 1, local.day));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7)); // back to Monday
  return day.toISOString().slice(0, 10);
}

// Grouped by weekday and part of day ("Sat morning"), not exact start time, so a one-off 7:04 AM
// game counts with the regular 6:30 AM ones.
function slotLabel(date: Date, timeZone: string) {
  const weekday = date.toLocaleString("en-US", { weekday: "short", timeZone });
  const hour = zonedParts(date, timeZone).hour;
  return `${weekday} ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}`;
}

const average = (values: number[]) => (values.length ? Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10 : 0);

export function computeAttendance(games: AttendanceGame[], members: AttendanceMember[], now: Date, timeZone: string) {
  const sorted = [...games].sort((a, b) => a.at.getTime() - b.at.getTime());
  const counts = sorted.map((game) => game.playedIds.length);

  // Weekly turnout, oldest first, including weeks with no games so gaps show.
  const weeks = new Map<string, number[]>();
  if (sorted.length) {
    const cursor = new Date(`${weekStart(sorted[0].at, timeZone)}T12:00:00Z`);
    const last = weekStart(now, timeZone);
    while (cursor.toISOString().slice(0, 10) <= last) {
      weeks.set(cursor.toISOString().slice(0, 10), []);
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
  }
  for (const game of sorted) weeks.get(weekStart(game.at, timeZone))?.push(game.playedIds.length);

  // Best days/times: average turnout per weekly slot ("Sat 6:30 AM").
  const slots = new Map<string, number[]>();
  for (const game of sorted) {
    const label = slotLabel(game.at, timeZone);
    slots.set(label, [...(slots.get(label) ?? []), game.playedIds.length]);
  }

  const memberRows: MemberAttendance[] = members.map((member) => {
    // Counted from when they joined -- or their first game, if earlier (join dates aren't always
    // reliable: some members joined the group after already playing in its games).
    const firstPlayed = sorted.find((game) => game.playedIds.includes(member.id))?.at;
    const since = member.joinedAt && (!firstPlayed || member.joinedAt < firstPlayed) ? member.joinedAt : firstPlayed ?? null;
    const eligible = sorted.filter((game) => !since || game.at >= since);
    const played = eligible.filter((game) => game.playedIds.includes(member.id));
    const satOut = eligible.filter((game) => game.joinedIds.includes(member.id) && !game.playedIds.includes(member.id)).length;
    return {
      id: member.id,
      name: member.name,
      played: played.length,
      possible: eligible.length,
      rate: eligible.length ? Math.round((played.length / eligible.length) * 100) : 0,
      lastPlayedAt: played.at(-1)?.at ?? null,
      joinedButSatOut: satOut,
    };
  }).sort((a, b) => b.played - a.played || b.rate - a.rate || a.name.localeCompare(b.name));

  const fadingSince = now.getTime() - FADING_DAYS * 86_400_000;
  return {
    totals: {
      games: sorted.length,
      averagePlayers: average(counts),
      uniquePlayers: new Set(sorted.flatMap((game) => game.playedIds)).size,
      activeMembers: memberRows.filter((row) => row.played > 0).length,
      members: members.length,
    },
    weeks: [...weeks].map(([start, players]) => ({ start, games: players.length, averagePlayers: average(players) })),
    slots: [...slots].map(([label, players]) => ({ label, games: players.length, averagePlayers: average(players) })).sort((a, b) => b.averagePlayers - a.averagePlayers || b.games - a.games),
    members: memberRows,
    fading: memberRows.filter((row) => row.played >= FADING_MIN_GAMES && row.lastPlayedAt && row.lastPlayedAt.getTime() < fadingSince),
    notYet: memberRows.filter((row) => row.played === 0 && row.possible > 0),
  };
}

export type AttendanceInsights = ReturnType<typeof computeAttendance>;
