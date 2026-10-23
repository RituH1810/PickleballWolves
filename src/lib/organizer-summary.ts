import type { AttendanceGame } from "./attendance";

// The Monday notification for a group's organizers: how last week went, who's drifting away, and
// what's coming up. Short enough to read in a phone notification; Insights has the detail.

export type SummaryInput = {
  groupName: string;
  lastWeek: AttendanceGame[];
  // The 4 weeks before last week, for "usual" turnout.
  baseline: AttendanceGame[];
  memberNames: Map<string, string>;
  fadingNames: string[];
  upcoming: { label: string; joined: number }[];
};

// Turnout this close to usual reads as "about the same".
const SAME_WITHIN = 0.5;
const MAX_NAMES = 3;

const average = (games: AttendanceGame[]) => games.reduce((total, game) => total + game.playedIds.length, 0) / games.length;
const round = (value: number) => Math.round(value * 10) / 10;

function names(list: string[]) {
  const shown = list.slice(0, MAX_NAMES).join(", ");
  return list.length > MAX_NAMES ? `${shown} +${list.length - MAX_NAMES} more` : shown;
}

/** The summary's title and body, or null when there's nothing to say (no games last week or ahead). */
export function buildOrganizerSummary(input: SummaryInput): { title: string; body: string } | null {
  const { groupName, lastWeek, baseline, memberNames, fadingNames, upcoming } = input;
  if (!lastWeek.length && !upcoming.length) return null;

  const lines: string[] = [];
  let title: string;
  if (lastWeek.length) {
    const turnout = average(lastWeek);
    title = `${groupName} last week: ${lastWeek.length} game${lastWeek.length === 1 ? "" : "s"}, ${round(turnout)} players avg`;
    if (baseline.length) {
      const usual = average(baseline);
      lines.push(Math.abs(turnout - usual) < SAME_WITHIN ? `About the same as usual (${round(usual)})` : `${turnout > usual ? "Up" : "Down"} from ${round(usual)} usual`);
    }
    const counts = new Map<string, number>();
    for (const game of lastWeek) for (const id of game.playedIds) if (memberNames.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
    const most = Math.max(0, ...counts.values());
    const leaders = names([...counts].filter(([, count]) => count === most).map(([id]) => memberNames.get(id)!));
    if (most >= 2) lines.push(most === lastWeek.length ? `Came to every game: ${leaders}` : `Most games: ${leaders} (${most})`);
  } else {
    title = `${groupName}: no games last week`;
  }
  if (fadingNames.length) lines.push(`Drifting away: ${names(fadingNames)}`);
  lines.push(upcoming.length ? `This week: ${upcoming.map((game) => `${game.label} (${game.joined} in)`).join(", ")}` : "Nothing scheduled this week yet");
  return { title, body: lines.join("\n") };
}
