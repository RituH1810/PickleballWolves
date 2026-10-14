import { NextResponse } from "next/server";
import { MembershipRole, MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

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
