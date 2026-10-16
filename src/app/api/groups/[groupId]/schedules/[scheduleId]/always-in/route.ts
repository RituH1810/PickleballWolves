import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

async function load(groupId: string, scheduleId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const [membership, schedule] = await Promise.all([
    prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } }),
    prisma.recurringSchedule.findUnique({ where: { id: scheduleId }, select: { groupId: true } }),
  ]);
  if (!schedule || schedule.groupId !== groupId) return { error: NextResponse.json({ error: "Schedule not found." }, { status: 404 }) };
  if (membership?.status !== MembershipStatus.ACTIVE) return { error: NextResponse.json({ error: "Join this group first." }, { status: 403 }) };
  return { userId: user.id };
}

// "Always in": join every game this schedule creates. Also joins the games it has already created
// that haven't started -- except ones the player specifically declined.
export async function POST(_request: Request, context: { params: Promise<{ groupId: string; scheduleId: string }> }) {
  const { groupId, scheduleId } = await context.params;
  const result = await load(groupId, scheduleId);
  if ("error" in result) return result.error;
  const { userId } = result;

  await prisma.recurringScheduleMember.upsert({ where: { scheduleId_userId: { scheduleId, userId } }, update: {}, create: { scheduleId, userId } });
  const upcoming = await prisma.roundRobin.findMany({ where: { recurringScheduleId: scheduleId, status: { in: ["SETUP", "LIVE"] }, scheduledAt: { gt: new Date() }, rsvps: { none: { userId } } }, select: { id: true } });
  if (upcoming.length) await prisma.roundRobinRSVP.createMany({ data: upcoming.map((game) => ({ roundRobinId: game.id, userId, status: "JOINED" as const })), skipDuplicates: true });
  return NextResponse.json({ alwaysIn: true, joined: upcoming.length });
}

// Turning it off only affects future games; games already joined stay joined (decline those individually).
export async function DELETE(_request: Request, context: { params: Promise<{ groupId: string; scheduleId: string }> }) {
  const { groupId, scheduleId } = await context.params;
  const result = await load(groupId, scheduleId);
  if ("error" in result) return result.error;
  await prisma.recurringScheduleMember.deleteMany({ where: { scheduleId, userId: result.userId } });
  return NextResponse.json({ alwaysIn: false });
}
