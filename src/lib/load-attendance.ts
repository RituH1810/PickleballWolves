import { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AttendanceGame, AttendanceMember } from "@/lib/attendance";

/**
 * A group's games held between `from` and `to` (round robins with at least one scored match) and
 * its active members -- the inputs to computeAttendance, shared by Insights and the weekly summary.
 */
export async function loadGroupAttendance(groupId: string, from: Date, to: Date): Promise<{ games: AttendanceGame[]; members: AttendanceMember[] }> {
  const [roundRobins, memberships] = await Promise.all([
    prisma.roundRobin.findMany({
      where: { groupId, OR: [{ scheduledAt: { gte: from, lt: to } }, { scheduledAt: null, createdAt: { gte: from, lt: to } }], matches: { some: { deletedAt: null, scores: { some: {} } } } },
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
  return {
    games: roundRobins.map((roundRobin) => ({
      id: roundRobin.id,
      at: roundRobin.scheduledAt ?? roundRobin.createdAt,
      playedIds: [...new Set(roundRobin.matches.flatMap((match) => match.players.map((player) => player.userId)))],
      joinedIds: roundRobin.rsvps.map((rsvp) => rsvp.userId),
    })),
    members: memberships.map((member) => ({ id: member.userId, name: member.user.name, joinedAt: member.joinedAt })),
  };
}
