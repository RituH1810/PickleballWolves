import { NextResponse } from "next/server";
import { MembershipRole, MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { computeAttendance } from "@/lib/attendance";
import { loadGroupAttendance } from "@/lib/load-attendance";
import { APP_TIME_ZONE } from "@/lib/app-time";

const PERIODS = [30, 90, 180];
const DEFAULT_PERIOD = 90;

// Attendance insights for a group's organizers: turnout over time, best days/times, and each
// member's attendance. Only round robins with at least one scored match count as games held.
export async function GET(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to see insights." }, { status: 401 });
  const { groupId } = await context.params;
  const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  if (membership?.status !== MembershipStatus.ACTIVE || membership.role !== MembershipRole.ORGANIZER) return NextResponse.json({ error: "Only group organizers can see attendance insights." }, { status: 403 });

  const requested = Number(new URL(request.url).searchParams.get("days"));
  const days = PERIODS.includes(requested) ? requested : DEFAULT_PERIOD;
  const now = new Date();
  const from = new Date(now.getTime() - days * 86_400_000);

  const [group, { games, members }] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    // lte now: a game that started a moment ago still counts.
    loadGroupAttendance(groupId, from, new Date(now.getTime() + 1)),
  ]);
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

  const insights = computeAttendance(games, members, now, APP_TIME_ZONE);
  return NextResponse.json({ groupName: group.name, days, periods: PERIODS, ...insights });
}
