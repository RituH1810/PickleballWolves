import { NextResponse } from "next/server";
import { MembershipRole, MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { describeSchedule, isValidTimeZone } from "@/lib/recurring";
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
    include: { roundRobins: { where: { scheduledAt: { gte: now } }, orderBy: { scheduledAt: "asc" }, take: 1, select: { id: true, name: true, scheduledAt: true } } },
  });
  const creators = await prisma.user.findMany({ where: { id: { in: schedules.map((schedule) => schedule.createdById) } }, select: { id: true, name: true } });
  const creatorById = new Map(creators.map((creator) => [creator.id, creator.name]));

  return NextResponse.json({
    canManage: membership.role === MembershipRole.ORGANIZER,
    schedules: schedules.map((schedule) => ({
      id: schedule.id,
      description: describeSchedule(schedule),
      timeZone: schedule.timeZone,
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

  const body = await request.json().catch(() => null);
  const daysOfWeek = Array.isArray(body?.daysOfWeek) ? [...new Set(body.daysOfWeek.filter((day: unknown): day is number => Number.isInteger(day) && (day as number) >= 0 && (day as number) <= 6))].sort((a, b) => (a as number) - (b as number)) as number[] : [];
  const timeOfDay = typeof body?.timeOfDay === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.timeOfDay) ? body.timeOfDay : null;
  const timeZone = typeof body?.timeZone === "string" && isValidTimeZone(body.timeZone) ? body.timeZone : null;
  const courtCount = Number(body?.courtCount);
  if (!daysOfWeek.length || !timeOfDay || !timeZone) return NextResponse.json({ error: "Pick at least one day and a start time." }, { status: 400 });
  if (!Number.isInteger(courtCount) || courtCount < 1 || courtCount > 20) return NextResponse.json({ error: "Courts must be between 1 and 20." }, { status: 400 });

  const schedule = await prisma.recurringSchedule.create({
    data: {
      groupId,
      createdById: user.id,
      daysOfWeek,
      timeOfDay,
      timeZone,
      courtCount,
      playFormat: ["SINGLES", "DOUBLES", "MIXED"].includes(body.playFormat) ? body.playFormat : "DOUBLES",
      partnerFormat: ["ROTATE", "FIXED", "MANUAL"].includes(body.partnerFormat) ? body.partnerFormat : "ROTATE",
      pointsToWin: [11, 15, 21].includes(Number(body.pointsToWin)) ? Number(body.pointsToWin) : 11,
      winBy: Number(body.winBy) === 2 ? 2 : 1,
      generatedThrough: new Date(),
    },
  });
  // Create the coming week's games right away rather than waiting for the next cron run.
  const created = await generateRecurringGames(new Date(), schedule.id);
  return NextResponse.json({ scheduleId: schedule.id, created }, { status: 201 });
}
