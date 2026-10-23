import { NextResponse } from "next/server";
import { MembershipRole, MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { computeAttendance } from "@/lib/attendance";
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

  const [group, roundRobins, memberships] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    prisma.roundRobin.findMany({
      where: { groupId, OR: [{ scheduledAt: { gte: from, lte: now } }, { scheduledAt: null, createdAt: { gte: from, lte: now } }], matches: { some: { deletedAt: null, scores: { some: {} } } } },
      select: {
        id: true,
        scheduledAt: true,
        createdAt: true,
        rsvps: { where: { status: "JOINED" }, select: { userId: true } },
        matches: { where: { deletedAt: null, scores: { some: {} } }, select: { players: { select: { userId: true } } } },
      },
    }),
    prisma.membership.findMany({ where: { groupId, status: MembershipStatus.ACTIVE }, select: { userId: true, joinedAt: true, user: { select: { name: true } } } }),
  ]);
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

  const insights = computeAttendance(
    roundRobins.map((roundRobin) => ({
      id: roundRobin.id,
      at: roundRobin.scheduledAt ?? roundRobin.createdAt,
      playedIds: [...new Set(roundRobin.matches.flatMap((match) => match.players.map((player) => player.userId)))],
      joinedIds: roundRobin.rsvps.map((rsvp) => rsvp.userId),
    })),
    memberships.map((member) => ({ id: member.userId, name: member.user.name, joinedAt: member.joinedAt })),
    now,
    APP_TIME_ZONE,
  );
  return NextResponse.json({ groupName: group.name, days, periods: PERIODS, ...insights });
}
