import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getResend, REMINDER_FROM_EMAIL } from "@/lib/resend";

const REMINDER_WINDOW_MS = 60 * 60 * 1000;

function formatWhen(date: Date) {
  return date.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

async function emailAllowed(userId: string) {
  const preference = await prisma.notificationPreference.findUnique({ where: { userId } });
  return preference ? preference.emailReminders : true;
}

async function sendReminder(resend: NonNullable<ReturnType<typeof getResend>>, to: string, name: string, subject: string, title: string, when: string, where: string, url: string) {
  const result = await resend.emails.send({
    from: REMINDER_FROM_EMAIL,
    to,
    subject,
    html: `<p>Hi ${name},</p><p>Quick reminder -- <strong>${title}</strong> starts soon.</p><p><strong>When:</strong> ${when}<br/><strong>Where:</strong> ${where}</p><p><a href="${url}">View details</a></p><p>See you on the court!<br/>PickleballWolves</p>`,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resend = getResend();
  const origin = new URL(request.url).origin;
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);
  let eventsReminded = 0;
  let roundRobinsReminded = 0;
  let emailsSent = 0;

  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED", reminderSentAt: null, startsAt: { gte: now, lte: windowEnd } },
    include: { rsvps: { where: { status: "GOING" }, include: { user: { select: { id: true, email: true, name: true } } } }, group: { select: { name: true } } },
  });
  for (const event of events) {
    if (resend) {
      for (const rsvp of event.rsvps) {
        if (!(await emailAllowed(rsvp.user.id))) continue;
        try {
          await sendReminder(resend, rsvp.user.email, rsvp.user.name, `Reminder: ${event.title} starts soon`, event.title, formatWhen(event.startsAt), event.location, `${origin}/events`);
          emailsSent += 1;
        } catch (error) {
          console.error("Failed to send event reminder", event.id, rsvp.user.email, error);
        }
      }
      await prisma.event.update({ where: { id: event.id }, data: { reminderSentAt: now } });
      eventsReminded += 1;
    }
  }

  const roundRobins = await prisma.roundRobin.findMany({
    where: { status: { in: ["SETUP", "LIVE"] }, groupId: { not: null }, reminderSentAt: null, scheduledAt: { gte: now, lte: windowEnd } },
    include: { rsvps: { where: { status: "JOINED" }, include: { user: { select: { id: true, email: true, name: true } } } }, group: { select: { name: true, location: true } } },
  });
  for (const roundRobin of roundRobins) {
    if (resend) {
      for (const rsvp of roundRobin.rsvps) {
        if (!(await emailAllowed(rsvp.user.id))) continue;
        try {
          await sendReminder(resend, rsvp.user.email, rsvp.user.name, `Reminder: ${roundRobin.name} starts soon`, roundRobin.name, formatWhen(roundRobin.scheduledAt!), roundRobin.group?.location ?? roundRobin.group?.name ?? "your group", `${origin}/round-robin/${roundRobin.id}`);
          emailsSent += 1;
        } catch (error) {
          console.error("Failed to send round robin reminder", roundRobin.id, rsvp.user.email, error);
        }
      }
      await prisma.roundRobin.update({ where: { id: roundRobin.id }, data: { reminderSentAt: now } });
      roundRobinsReminded += 1;
    }
  }

  return NextResponse.json({ resendConfigured: Boolean(resend), eventsReminded, roundRobinsReminded, emailsSent });
}
