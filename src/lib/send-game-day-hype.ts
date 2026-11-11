import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APP_TIME_ZONE } from "@/lib/app-time";
import { headToHead, recentForm, type FormMatch } from "@/lib/form";
import { HYPE_MIN_LEAD_MS, hypeBody, hypeTitle, isHypeTime } from "@/lib/game-day-hype";
import { notify } from "@/lib/notifications";

const TYPE = "GAME_DAY_HYPE";

/**
 * Sends each player who's joined a round robin later today one personalized game-day push
 * (from 9 AM, until 2 hours before it starts). Run from the 15-minute reminder cron; a player is
 * skipped if they already got this round robin's message today, so late joiners get one too.
 * Follows the in-app reminders switch.
 */
export async function sendGameDayHype(now = new Date()) {
  const roundRobins = await prisma.roundRobin.findMany({
    where: { status: { not: "COMPLETED" }, scheduledAt: { gte: new Date(now.getTime() + HYPE_MIN_LEAD_MS), lt: new Date(now.getTime() + 24 * 3_600_000) } },
    select: { id: true, name: true, scheduledAt: true, rsvps: { where: { status: "JOINED" }, select: { user: { select: { id: true, name: true, isGuest: true } } } } },
  });
  let sent = 0;
  for (const roundRobin of roundRobins) {
    if (!roundRobin.scheduledAt || !isHypeTime(roundRobin.scheduledAt, now, APP_TIME_ZONE)) continue;
    const joined = roundRobin.rsvps.map((rsvp) => rsvp.user);
    const recipients = joined.filter((user) => !user.isGuest);
    if (!recipients.length) continue;
    const title = hypeTitle(roundRobin.name);
    const already = new Set((await prisma.notification.findMany({ where: { type: TYPE, title, userId: { in: recipients.map((user) => user.id) }, createdAt: { gte: new Date(now.getTime() - 20 * 3_600_000) } }, select: { userId: true } })).map((row) => row.userId));
    const pending = recipients.filter((user) => !already.has(user.id));
    if (!pending.length) continue;

    const matches = await prisma.match.findMany({ where: { status: MatchStatus.COMPLETED, deletedAt: null, players: { some: { userId: { in: joined.map((user) => user.id) } } } }, select: { updatedAt: true, players: { select: { userId: true, side: true } }, scores: { select: { sideAScore: true, sideBScore: true } } } });
    const history: FormMatch[] = matches.map((match) => ({ playedAt: match.updatedAt, players: match.players, scores: match.scores }));
    const own = (userId: string) => history.filter((match) => match.players.some((player) => player.userId === userId));
    const profile = new Map(joined.map((user) => {
      const games = own(user.id);
      const streak = recentForm(games, user.id).streak;
      return [user.id, { userId: user.id, name: user.name, streak: streak?.result === "W" ? streak.length : 0, matches: games.length }];
    }));
    const when = `Today ${roundRobin.scheduledAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: APP_TIME_ZONE })}`;

    for (const user of pending) {
      const others = joined.filter((other) => other.id !== user.id).map((other) => profile.get(other.id)!);
      const mine = own(user.id);
      const versus = new Map(others.map((other) => [other.userId, headToHead(mine, user.id, other.userId).against]));
      await notify(user.id, "reminder", TYPE, title, hypeBody({ when, joined: joined.length, me: profile.get(user.id)!, others, versus }), `/round-robin/${roundRobin.id}`);
      sent += 1;
    }
  }
  return { hypeSent: sent };
}
