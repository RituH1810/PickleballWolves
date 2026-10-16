import { NextResponse } from "next/server";
import { MembershipRole, MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { describeSchedule, occurrenceName, occurrencesBetween, parseScheduleBody, rescheduledTime } from "@/lib/recurring";
import { createScheduledGames } from "@/lib/generate-recurring";

// Stops the schedule. Games it already created stay put (their link is just cleared), so anyone
// who RSVP'd keeps their spot; organizers can delete those individually if needed.
export async function DELETE(_request: Request, context: { params: Promise<{ groupId: string; scheduleId: string }> }) {
  const { groupId, scheduleId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  if (membership?.status !== MembershipStatus.ACTIVE || membership.role !== MembershipRole.ORGANIZER) return NextResponse.json({ error: "Only group organizers can stop a schedule." }, { status: 403 });

  const schedule = await prisma.recurringSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule || schedule.groupId !== groupId) return NextResponse.json({ error: "Schedule not found." }, { status: 404 });

  await prisma.recurringSchedule.delete({ where: { id: scheduleId } });
  return NextResponse.json({ ok: true });
}

/**
 * Edits a schedule and carries the change to games it already created that haven't started:
 * kept weekdays move to the new time and settings (players who joined are told), dropped weekdays
 * are deleted when nobody's joined (otherwise left for the organizer to decide), and newly added
 * weekdays get their games for the window already generated.
 */
export async function PATCH(request: Request, context: { params: Promise<{ groupId: string; scheduleId: string }> }) {
  const { groupId, scheduleId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  if (membership?.status !== MembershipStatus.ACTIVE || membership.role !== MembershipRole.ORGANIZER) return NextResponse.json({ error: "Only group organizers can edit a schedule." }, { status: 403 });

  const existing = await prisma.recurringSchedule.findUnique({ where: { id: scheduleId } });
  if (!existing || existing.groupId !== groupId) return NextResponse.json({ error: "Schedule not found." }, { status: 404 });

  // The schedule keeps its own time zone; editing from another zone doesn't shift it.
  const parsed = parseScheduleBody(await request.json().catch(() => null), existing.timeZone);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { fields } = parsed;

  const schedule = await prisma.recurringSchedule.update({ where: { id: scheduleId }, data: fields, include: { group: { select: { name: true } } } });
  const now = new Date();
  const upcoming = await prisma.roundRobin.findMany({
    where: { recurringScheduleId: scheduleId, status: "SETUP", scheduledAt: { gt: now }, matches: { none: {} } },
    include: { rsvps: { where: { status: "JOINED" }, select: { userId: true } } },
  });

  let updated = 0;
  let removed = 0;
  const kept: string[] = [];
  for (const game of upcoming) {
    const newTime = rescheduledTime(game.scheduledAt!, fields);
    if (!newTime) {
      if (game.rsvps.length) { kept.push(game.name); continue; }
      await prisma.roundRobin.delete({ where: { id: game.id } });
      removed += 1;
      continue;
    }
    const name = occurrenceName(schedule.group.name, newTime, fields.timeZone);
    await prisma.roundRobin.update({ where: { id: game.id }, data: { scheduledAt: newTime, name, courtCount: fields.courtCount, playFormat: fields.playFormat, partnerFormat: fields.partnerFormat, pointsToWin: fields.pointsToWin, winBy: fields.winBy } });
    updated += 1;
    if (newTime.getTime() !== game.scheduledAt!.getTime()) {
      const when = newTime.toLocaleString("en-US", { timeZone: fields.timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      await Promise.all(game.rsvps.filter((rsvp) => rsvp.userId !== user.id).map((rsvp) => notify(rsvp.userId, "general", "ROUND_ROBIN_RESCHEDULED", `Time changed: ${name}`, `The organizer moved this game to ${when}. You're still in.`)));
    }
  }

  // Days added to the schedule: fill in the games the generator has already gone past.
  const addedDays = fields.daysOfWeek.filter((day) => !existing.daysOfWeek.includes(day));
  const created = addedDays.length && schedule.generatedThrough > now
    ? await createScheduledGames(schedule, occurrencesBetween({ ...fields, daysOfWeek: addedDays }, now, schedule.generatedThrough))
    : 0;

  return NextResponse.json({ description: describeSchedule(schedule), updated, removed, kept, created });
}
