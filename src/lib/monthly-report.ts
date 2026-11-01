import { winningSide } from "./achievements";

export type ReportMatch = { id: string; playedAt: Date; winnerSide: "A" | "B" | null; players: { userId: string; name: string; side: "A" | "B" }[]; scores: { gameNumber: number; sideAScore: number; sideBScore: number }[] };
export type MonthlyReport = {
  matches: number;
  wins: number;
  losses: number;
  ratingChange: number | null;
  ratingNow: number | null;
  bestPartner: { name: string; wins: number; losses: number } | null;
  bestMoment: string | null;
};

const firstName = (name: string) => name.split(" ")[0];
const shortDate = (date: Date, timeZone: string) => date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });

/**
 * One player's month: matches, record, rating change, best partner (most wins together, then the
 * better record) and best moment (a round robin title, else their biggest win). Null with no
 * scored matches.
 */
export function computeMonthlyReport(input: { userId: string; matches: ReportMatch[]; ratingRows: { ratingDelta: number; ratingAfter: number; createdAt: Date }[]; titles: string[]; timeZone: string }): MonthlyReport | null {
  let wins = 0;
  let losses = 0;
  const partners = new Map<string, { name: string; wins: number; losses: number }>();
  let biggest: { match: ReportMatch; margin: number; mine: number; theirs: number; opponents: string[] } | null = null;

  for (const match of [...input.matches].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime())) {
    const side = match.players.find((player) => player.userId === input.userId)?.side;
    if (!side || !match.scores.length) continue;
    const winner = winningSide(match);
    if (!winner) continue;
    const won = winner === side;
    if (won) wins += 1; else losses += 1;
    for (const partner of match.players.filter((player) => player.side === side && player.userId !== input.userId)) {
      const entry = partners.get(partner.userId) ?? { name: partner.name, wins: 0, losses: 0 };
      if (won) entry.wins += 1; else entry.losses += 1;
      partners.set(partner.userId, entry);
    }
    const mine = match.scores.reduce((total, score) => total + (side === "A" ? score.sideAScore : score.sideBScore), 0);
    const theirs = match.scores.reduce((total, score) => total + (side === "A" ? score.sideBScore : score.sideAScore), 0);
    if (won && (!biggest || mine - theirs > biggest.margin)) biggest = { match, margin: mine - theirs, mine, theirs, opponents: match.players.filter((player) => player.side !== side).map((player) => firstName(player.name)) };
  }
  if (!wins && !losses) return null;

  const bestPartner = [...partners.values()].filter((entry) => entry.wins > 0).sort((a, b) => b.wins - a.wins || a.losses - b.losses)[0] ?? null;
  const rows = [...input.ratingRows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const bestMoment = input.titles.length > 1 ? `won ${input.titles.length} round robin titles`
    : input.titles.length === 1 ? `won ${input.titles[0]}`
    : biggest ? `beat ${biggest.opponents.join(" & ")} ${biggest.mine}-${biggest.theirs} on ${shortDate(biggest.match.playedAt, input.timeZone)}`
    : null;
  return {
    matches: wins + losses,
    wins,
    losses,
    ratingChange: rows.length ? Math.round(rows.reduce((total, row) => total + row.ratingDelta, 0) * 1000) / 1000 : null,
    ratingNow: rows.at(-1)?.ratingAfter ?? null,
    bestPartner: bestPartner && { name: bestPartner.name, wins: bestPartner.wins, losses: bestPartner.losses },
    bestMoment,
  };
}

/** The push/in-app message for a report: "14 matches, 9-5 · rating +0.042 to 3.354 · ...". */
export function reportMessage(report: MonthlyReport, monthName: string) {
  const parts = [`${report.matches} match${report.matches === 1 ? "" : "es"}, ${report.wins}-${report.losses}`];
  if (report.ratingChange !== null && report.ratingNow !== null) parts.push(`rating ${report.ratingChange >= 0 ? "+" : "−"}${Math.abs(report.ratingChange).toFixed(3)} to ${report.ratingNow.toFixed(3)}`);
  if (report.bestPartner) parts.push(`best partner ${firstName(report.bestPartner.name)} (${report.bestPartner.wins}-${report.bestPartner.losses})`);
  if (report.bestMoment) parts.push(`best moment: you ${report.bestMoment}`);
  return { title: `Your ${monthName} report card`, body: parts.join(" · ") };
}
