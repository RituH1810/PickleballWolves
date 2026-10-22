import { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getResend, REMINDER_FROM_EMAIL } from "@/lib/resend";
import { loadAchievements } from "@/lib/load-achievements";
import { DIGEST_TIME_ZONE, isEmptyDigest, renderDigestEmail, type DigestData } from "@/lib/weekly-digest";

const WEEK_MS = 7 * 86_400_000;
// Resend accepts up to 100 emails per batch call.
const BATCH_SIZE = 100;

/** One player's digest: games in the next 7 days, and games, rating, and badges from the last 7. */
export async function buildDigest(userId: string, now = new Date()): Promise<DigestData | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, skillRating: true } });
  if (!user) return null;
  const weekAgo = new Date(now.getTime() - WEEK_MS);
  const weekAhead = new Date(now.getTime() + WEEK_MS);
  const myGroupIds = (await prisma.membership.findMany({ where: { userId, status: MembershipStatus.ACTIVE }, select: { groupId: true } })).map((membership) => membership.groupId);

  const [games, matches, ratingRows, unlocks] = await Promise.all([
    prisma.roundRobin.findMany({
      where: { status: { in: ["SETUP", "LIVE"] }, scheduledAt: { gt: now, lte: weekAhead }, OR: [{ createdById: userId }, { rsvps: { some: { userId, status: "JOINED" } } }, { groupId: { in: myGroupIds }, rsvps: { none: { userId } } }] },
      orderBy: { scheduledAt: "asc" },
      select: { id: true, name: true, scheduledAt: true, createdById: true, rsvps: { where: { userId }, select: { status: true } } },
    }),
    prisma.match.findMany({ where: { status: "COMPLETED", deletedAt: null, updatedAt: { gte: weekAgo, lt: now }, players: { some: { userId } } }, select: { players: { select: { userId: true, side: true } }, scores: { select: { sideAScore: true, sideBScore: true } } } }),
    prisma.ratingHistory.findMany({ where: { userId, ladderId: null, createdAt: { gte: weekAgo, lt: now } }, select: { ratingDelta: true } }),
    prisma.achievementUnlock.findMany({ where: { userId, unlockedAt: { gte: weekAgo, lt: now } }, select: { achievementId: true } }),
  ]);

  // Game-by-game wins and losses, the way round robin standings count them.
  let wins = 0;
  let losses = 0;
  for (const match of matches) {
    const side = match.players.find((player) => player.userId === userId)!.side;
    for (const score of match.scores) {
      const own = side === "A" ? score.sideAScore : score.sideBScore;
      const other = side === "A" ? score.sideBScore : score.sideAScore;
      if (own > other) wins += 1; else if (own < other) losses += 1;
    }
  }

  const unlockedIds = new Set(unlocks.map((unlock) => unlock.achievementId));
  const badges = unlockedIds.size ? (await loadAchievements(userId)).filter((achievement) => unlockedIds.has(achievement.id)).map(({ name, description }) => ({ name, description })) : [];

  return {
    name: user.name,
    upcoming: games.map((game) => ({
      name: game.name,
      when: game.scheduledAt!.toLocaleString("en-US", { timeZone: DIGEST_TIME_ZONE, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      path: `/round-robin/${game.id}`,
      status: game.createdById === userId || game.rsvps[0]?.status === "JOINED" ? "in" : "invited",
    })),
    lastWeek: { wins, losses, ratingChange: ratingRows.length ? Math.round(ratingRows.reduce((total, row) => total + Number(row.ratingDelta), 0) * 100) / 100 : null, rating: Number(user.skillRating) },
    badges,
  };
}

/**
 * Emails every player who has the weekly digest on (the default) and something to report.
 * Skips placeholder addresses. Returns what happened so the cron log is useful.
 */
export async function sendWeeklyDigests(siteUrl: string, now = new Date()) {
  const resend = getResend();
  if (!resend) return { sent: 0, skipped: "RESEND_API_KEY is not configured." };

  const [users, optedOut] = await Promise.all([
    prisma.user.findMany({ where: { isGuest: false }, select: { id: true, email: true } }),
    prisma.notificationPreference.findMany({ where: { weeklyDigest: false }, select: { userId: true } }),
  ]);
  const off = new Set(optedOut.map((row) => row.userId));
  const emails = [];
  let empty = 0;
  for (const user of users) {
    if (off.has(user.id) || !user.email || /@(placeholder\.local|example\.invalid)$/i.test(user.email)) continue;
    const digest = await buildDigest(user.id, now);
    if (!digest || isEmptyDigest(digest)) { empty += 1; continue; }
    const { subject, html, text } = renderDigestEmail(digest, siteUrl);
    emails.push({ from: REMINDER_FROM_EMAIL, to: user.email, subject, html, text });
  }

  let sent = 0;
  const failures: string[] = [];
  for (let index = 0; index < emails.length; index += BATCH_SIZE) {
    const batch = emails.slice(index, index + BATCH_SIZE);
    const { error } = await resend.batch.send(batch);
    if (error) failures.push(error.message); else sent += batch.length;
  }
  return { sent, attempted: emails.length, optedOut: off.size, nothingToReport: empty, failures };
}
