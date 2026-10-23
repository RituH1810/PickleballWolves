import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { weatherAt } from "@/lib/load-weather";
import { zonedParts, zonedTimeToUtc } from "@/lib/recurring";
import { LEADERBOARD_TIME_ZONE } from "@/lib/monthly-leaderboard";

const TIME_ZONE = LEADERBOARD_TIME_ZONE;

/** Local midnight-to-midnight for tomorrow, as UTC instants. */
function tomorrow(now: Date) {
  const local = zonedParts(now, TIME_ZONE);
  const day = (offset: number) => {
    const date = new Date(Date.UTC(local.year, local.month - 1, local.day + offset));
    return zonedTimeToUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), 0, 0, TIME_ZONE);
  };
  return { start: day(1), end: day(2) };
}

function when(date: Date) {
  return date.toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE });
}

/**
 * Runs each evening: for every game tomorrow whose forecast has a warning (rain, storms, snow,
 * heat, cold, strong wind), tells the players who are in. Each game is alerted at most once.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { start, end } = tomorrow(new Date());
  const [roundRobins, events] = await Promise.all([
    prisma.roundRobin.findMany({
      where: { status: { in: ["SETUP", "LIVE"] }, scheduledAt: { gte: start, lt: end }, weatherAlertSentAt: null },
      select: { id: true, name: true, scheduledAt: true, group: { select: { name: true, location: true } }, rsvps: { where: { status: "JOINED" }, select: { userId: true } } },
    }),
    prisma.event.findMany({
      where: { status: "PUBLISHED", startsAt: { gte: start, lt: end }, weatherAlertSentAt: null },
      select: { id: true, title: true, startsAt: true, location: true, rsvps: { where: { status: "GOING" }, select: { userId: true } } },
    }),
  ]);

  const games = [
    ...roundRobins.map((roundRobin) => ({ kind: "roundRobin" as const, id: roundRobin.id, name: roundRobin.name, startsAt: roundRobin.scheduledAt!, location: roundRobin.group?.location ?? null, playerIds: roundRobin.rsvps.map((rsvp) => rsvp.userId), url: `/round-robin/${roundRobin.id}` })),
    ...events.map((event) => ({ kind: "event" as const, id: event.id, name: event.title, startsAt: event.startsAt, location: event.location, playerIds: event.rsvps.map((rsvp) => rsvp.userId), url: "/events" })),
  ];

  const alerted: string[] = [];
  for (const game of games) {
    if (!game.playerIds.length) continue;
    const weather = await weatherAt(game.location, game.startsAt);
    if (!weather?.warnings.length) continue;
    const body = `${when(game.startsAt)} at ${game.location}: ${weather.warnings.join("; ")} (${weather.summary}). Check with your organizer before heading out.`;
    await Promise.all(game.playerIds.map((userId) => notify(userId, "reminder", "WEATHER_ALERT", `Weather heads-up: ${game.name}`, body, game.url)));
    if (game.kind === "roundRobin") await prisma.roundRobin.update({ where: { id: game.id }, data: { weatherAlertSentAt: new Date() } });
    else await prisma.event.update({ where: { id: game.id }, data: { weatherAlertSentAt: new Date() } });
    alerted.push(`${game.name}: ${weather.warnings.join("; ")}`);
  }
  return NextResponse.json({ window: { start, end }, checked: games.length, alerted });
}
