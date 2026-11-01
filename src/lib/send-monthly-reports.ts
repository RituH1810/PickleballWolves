import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { loadTitleTimeline } from "@/lib/load-recap";
import { LEADERBOARD_TIME_ZONE, recentMonths, type MonthWindow } from "@/lib/monthly-leaderboard";
import { computeMonthlyReport, reportMessage } from "@/lib/monthly-report";

/** The month that most recently ended, on the leaderboards' calendar. */
export const lastMonth = (now = new Date()) => recentMonths(now, 2)[1];

/**
 * Sends every player who played last month their report card (in-app and to their phone; it
 * follows the weekly digest switch). Players already sent that month's report are skipped, so
 * re-runs never double-send. With `onlyUserId`, just that player (for a preview).
 */
export async function sendMonthlyReports(month: MonthWindow = lastMonth(), onlyUserId?: string) {
  const type = `MONTHLY_REPORT_${month.key}`;
  const monthName = month.label.split(" ")[0];
  const matches = await prisma.match.findMany({
    where: { status: MatchStatus.COMPLETED, deletedAt: null, updatedAt: { gte: month.start, lt: month.end }, scores: { some: {} }, ...(onlyUserId ? { players: { some: { userId: onlyUserId } } } : {}) },
    select: { id: true, updatedAt: true, winnerSide: true, players: { select: { userId: true, side: true, user: { select: { name: true, isGuest: true } } } }, scores: { select: { gameNumber: true, sideAScore: true, sideBScore: true } } },
  });
  const playerIds = [...new Set(matches.flatMap((match) => match.players.filter((player) => !player.user.isGuest).map((player) => player.userId)))].filter((id) => !onlyUserId || id === onlyUserId);
  const alreadySent = new Set((await prisma.notification.findMany({ where: { type, userId: { in: playerIds } }, select: { userId: true } })).map((row) => row.userId));
  const reportMatches = matches.map((match) => ({ id: match.id, playedAt: match.updatedAt, winnerSide: match.winnerSide, scores: match.scores, players: match.players.map((player) => ({ userId: player.userId, name: player.user.name, side: player.side })) }));

  const sent: { userId: string; title: string; body: string }[] = [];
  for (const userId of playerIds) {
    if (alreadySent.has(userId)) continue;
    const [ratingRows, titles] = await Promise.all([
      prisma.ratingHistory.findMany({ where: { userId, ladderId: null, createdAt: { gte: month.start, lt: month.end } }, select: { ratingDelta: true, ratingAfter: true, createdAt: true } }),
      loadTitleTimeline(userId),
    ]);
    const report = computeMonthlyReport({
      userId,
      matches: reportMatches.filter((match) => match.players.some((player) => player.userId === userId)),
      ratingRows: ratingRows.map((row) => ({ ratingDelta: Number(row.ratingDelta), ratingAfter: Number(row.ratingAfter), createdAt: row.createdAt })),
      titles: titles.filter((title) => title.endedAt >= month.start && title.endedAt < month.end).map((title) => title.name),
      timeZone: LEADERBOARD_TIME_ZONE,
    });
    if (!report) continue;
    const { title, body } = reportMessage(report, monthName);
    await notify(userId, "digest", type, title, body, "/profile");
    sent.push({ userId, title, body });
  }
  return { month: month.key, sent: sent.length, skipped: alreadySent.size };
}
