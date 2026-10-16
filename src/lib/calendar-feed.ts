import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { buildIcs, type CalendarItem } from "@/lib/calendar";

const DAY_MS = 86_400_000;
// Recent history stays on the calendar; the future reaches as far as anything is scheduled.
const PAST_DAYS = 30;
const FUTURE_DAYS = 120;

/** A fresh unguessable feed token (also used when a player resets their link). */
export function newCalendarToken() {
  return randomBytes(24).toString("base64url");
}

/** The player's feed token, creating one the first time they ask. */
export async function calendarTokenFor(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { calendarToken: true } });
  if (user?.calendarToken) return user.calendarToken;
  const token = newCalendarToken();
  await prisma.user.update({ where: { id: userId }, data: { calendarToken: token } });
  return token;
}

export function feedUrls(siteUrl: string, token: string) {
  const https = `${siteUrl}/api/calendar/feed/${token}.ics`;
  const webcal = https.replace(/^https?:\/\//, "webcal://");
  return { https, webcal, google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}` };
}

/**
 * Everything on the player's calendar: round robins they organize or joined, events they're going
 * to, and their league matches. Round robins ended without being played drop off.
 */
export async function buildCalendarFeed(userId: string, siteUrl: string, now = new Date()) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  const from = new Date(now.getTime() - PAST_DAYS * DAY_MS);
  const to = new Date(now.getTime() + FUTURE_DAYS * DAY_MS);

  const [roundRobins, events, leagueMatches] = await Promise.all([
    prisma.roundRobin.findMany({
      where: {
        scheduledAt: { gte: from, lte: to },
        OR: [{ createdById: userId }, { rsvps: { some: { userId, status: "JOINED" } } }],
        AND: [{ OR: [{ status: { in: ["SETUP", "LIVE"] } }, { status: "COMPLETED", matches: { some: { deletedAt: null, scores: { some: {} } } } }] }],
      },
      select: { id: true, name: true, scheduledAt: true, courtCount: true, playFormat: true, group: { select: { location: true } } },
    }),
    prisma.event.findMany({
      where: { startsAt: { gte: from, lte: to }, status: { in: ["PUBLISHED", "COMPLETED"] }, rsvps: { some: { userId, status: "GOING" } } },
      select: { id: true, title: true, startsAt: true, endsAt: true, location: true, description: true, groupId: true, group: { select: { name: true } } },
    }),
    prisma.leagueMatch.findMany({
      where: { scheduledAt: { gte: from, lte: to }, match: { deletedAt: null, players: { some: { userId } } } },
      select: { matchId: true, weekNumber: true, scheduledAt: true, seasonId: true, season: { select: { league: { select: { name: true } } } }, match: { select: { courtNumber: true, players: { select: { userId: true, side: true, user: { select: { name: true } } } } } } },
    }),
  ]);

  const items: CalendarItem[] = [
    ...roundRobins.map((roundRobin) => ({
      uid: `roundRobin-${roundRobin.id}`,
      title: roundRobin.name,
      start: roundRobin.scheduledAt!,
      location: roundRobin.group?.location ?? null,
      description: `${roundRobin.playFormat.charAt(0)}${roundRobin.playFormat.slice(1).toLowerCase()} round robin · ${roundRobin.courtCount} court${roundRobin.courtCount === 1 ? "" : "s"}`,
      url: `${siteUrl}/round-robin/${roundRobin.id}`,
    })),
    ...events.map((event) => ({
      uid: `event-${event.id}`,
      title: event.group ? `${event.group.name} - ${event.title}` : event.title,
      start: event.startsAt,
      end: event.endsAt,
      location: event.location,
      description: event.description,
      url: event.groupId ? `${siteUrl}/groups/${event.groupId}` : `${siteUrl}/events`,
    })),
    ...leagueMatches.map((leagueMatch) => {
      const mySide = leagueMatch.match.players.find((player) => player.userId === userId)?.side;
      const partners = leagueMatch.match.players.filter((player) => player.side === mySide && player.userId !== userId).map((player) => player.user.name);
      const opponents = leagueMatch.match.players.filter((player) => player.side !== mySide).map((player) => player.user.name);
      return {
        uid: `leagueMatch-${leagueMatch.matchId}`,
        title: `${leagueMatch.season.league.name} - Week ${leagueMatch.weekNumber}`,
        start: leagueMatch.scheduledAt,
        durationMinutes: 90,
        description: `${partners.length ? `With ${partners.join(" & ")} ` : ""}vs ${opponents.join(" & ") || "TBD"}${leagueMatch.match.courtNumber ? ` · Court ${leagueMatch.match.courtNumber}` : ""}`,
        url: `${siteUrl}/leagues/${leagueMatch.seasonId}`,
      };
    }),
  ];
  return buildIcs(items, now, { name: `PickleballWolves${user ? ` -- ${user.name.split(" ")[0]}` : ""}`, refreshMinutes: 60 });
}
