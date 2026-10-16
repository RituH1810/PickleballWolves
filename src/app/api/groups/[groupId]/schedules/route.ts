import { NextResponse } from "next/server";
import { MembershipRole, MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { describeSchedule, parseScheduleBody } from "@/lib/recurring";
import { generateRecurringGames } from "@/lib/generate-recurring";

async function getMembership(groupId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, membership: null };
  const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  return { user, membership: membership?.status === MembershipStatus.ACTIVE ? membership : null };
}

export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;
  const { user, membership } = await getMembership(groupId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!membership) return NextResponse.json({ error: "Join this group to see its schedule." }, { status: 403 });

  const now = new Date();
  const schedules = await prisma.recurringSchedule.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
    include: {
      roundRobins: { where: { scheduledAt: { gte: now } }, orderBy: { scheduledAt: "asc" }, take: 1, select: { id: true, name: true, scheduledAt: true } },
      alwaysIn: { select: { userId: true } },
    },
  });
  const creators = await prisma.user.findMany({ where: { id: { in: schedules.map((schedule) => schedule.createdById) } }, select: { id: true, name: true } });
  const creatorById = new Map(creators.map((creator) => [creator.id, creator.name]));

  return NextResponse.json({
    canManage: membership.role === MembershipRole.ORGANIZER,
    schedules: schedules.map((schedule) => ({
      id: schedule.id,
      description: describeSchedule(schedule),
      daysOfWeek: schedule.daysOfWeek,
      timeOfDay: schedule.timeOfDay,
      timeZone: schedule.timeZone,
      winBy: schedule.winBy,
      alwaysInCount: schedule.alwaysIn.length,
      amAlwaysIn: schedule.alwaysIn.some((entry) => entry.userId === user.id),
      playFormat: schedule.playFormat,
      partnerFormat: schedule.partnerFormat,
      courtCount: schedule.courtCount,
      pointsToWin: schedule.pointsToWin,
      createdByName: creatorById.get(schedule.createdById) ?? "Former organizer",
      nextGame: schedule.roundRobins[0] ?? null,
    })),
  });
}

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;
  const { user, membership } = await getMembership(groupId);
  if (!user) return NextResponse.json({ error: "Sign in to set up a schedule." }, { status: 401 });
  if (membership?.role !== MembershipRole.ORGANIZER) return NextResponse.json({ error: "Only group organizers can set up recurring games." }, { status: 403 });

  // A new schedule runs in the organizer's own time zone (sent by their browser).
  const body = await request.json().catch(() => null);
  const parsed = parseScheduleBody(body, typeof body?.timeZone === "string" ? body.timeZone : null);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const schedule = await prisma.recurringSchedule.create({ data: { groupId, createdById: user.id, ...parsed.fields, generatedThrough: new Date() } });
  // Create the coming week's games right away rather than waiting for the next cron run.
  const created = await generateRecurringGames(new Date(), schedule.id);
  return NextResponse.json({ scheduleId: schedule.id, created }, { status: 201 });
}
