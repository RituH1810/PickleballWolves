import { MembershipRole, MembershipStatus, type RecurringSchedule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { GENERATE_AHEAD_DAYS, occurrenceName, occurrencesBetween } from "@/lib/recurring";

/**
 * Creates one group round robin per occurrence, announced exactly like a hand-made one. Members
 * who chose "Always in" for the schedule are joined automatically and told they're in; everyone
 * else gets the usual invite.
 */
export async function createScheduledGames(schedule: RecurringSchedule & { group: { name: string } }, occurrences: Date[]) {
  if (!occurrences.length) return 0;
  const [organizer, members, alwaysIn] = await Promise.all([
    prisma.user.findUnique({ where: { id: schedule.createdById }, select: { name: true } }),
    prisma.membership.findMany({ where: { groupId: schedule.groupId, status: MembershipStatus.ACTIVE, userId: { not: schedule.createdById } }, select: { userId: true } }),
    prisma.recurringScheduleMember.findMany({ where: { scheduleId: schedule.id }, select: { userId: true } }),
  ]);
  // Only current active members are auto-joined -- someone who left the group isn't signed up.
  const activeIds = new Set([schedule.createdById, ...members.map((member) => member.userId)]);
  const autoJoinIds = alwaysIn.map((entry) => entry.userId).filter((userId) => activeIds.has(userId));

  for (const scheduledAt of occurrences) {
    const name = occurrenceName(schedule.group.name, scheduledAt, schedule.timeZone);
    // Same defaults as POST /api/round-robin.
    const roundRobin = await prisma.roundRobin.create({ data: { name, createdById: schedule.createdById, groupId: schedule.groupId, scheduledAt, format: "POPCORN", partnerFormat: schedule.partnerFormat, playFormat: schedule.playFormat, courtCount: schedule.courtCount, roundCount: 4, pointsToWin: schedule.pointsToWin, winBy: schedule.winBy, recurringScheduleId: schedule.id } });
    if (autoJoinIds.length) await prisma.roundRobinRSVP.createMany({ data: autoJoinIds.map((userId) => ({ roundRobinId: roundRobin.id, userId, status: "JOINED" as const })) });
    await Promise.all(members.map((member) => autoJoinIds.includes(member.userId)
      ? notify(member.userId, "general", "ROUND_ROBIN_AUTO_JOINED", `You're in: ${name}`, `You're set to Always in for ${schedule.group.name}'s weekly game, so you've been added. Decline from the game page if you can't make it.`)
      : notify(member.userId, "general", "ROUND_ROBIN_CREATED", `New game in ${schedule.group.name}`, `${organizer?.name ?? "An organizer"} scheduled ${name}. Check your invites to join or pass.`)));
  }
  return occurrences.length;
}

/**
 * Turns every schedule's occurrences in the next GENERATE_AHEAD_DAYS into regular group round
 * robins. Safe to run as often as you like: each schedule's window is claimed (generatedThrough)
 * before anything is created, so overlapping runs can't double-create, and a game an organizer
 * deletes stays deleted.
 */
export async function generateRecurringGames(now = new Date(), scheduleId?: string) {
  const horizon = new Date(now.getTime() + GENERATE_AHEAD_DAYS * 86_400_000);
  const schedules = await prisma.recurringSchedule.findMany({ where: { ...(scheduleId ? { id: scheduleId } : {}), generatedThrough: { lt: horizon } }, include: { group: { select: { name: true } } } });
  let created = 0;

  for (const schedule of schedules) {
    // Games go out under the organizer who set the schedule up. If they've left the group or
    // stepped down, pause until another organizer replaces the schedule.
    const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId: schedule.groupId, userId: schedule.createdById } } });
    if (membership?.status !== MembershipStatus.ACTIVE || membership.role !== MembershipRole.ORGANIZER) continue;

    const claimed = await prisma.recurringSchedule.updateMany({ where: { id: schedule.id, generatedThrough: schedule.generatedThrough }, data: { generatedThrough: horizon } });
    if (!claimed.count) continue;

    // Never back-fill games whose time has already passed.
    const from = schedule.generatedThrough > now ? schedule.generatedThrough : now;
    created += await createScheduledGames(schedule, occurrencesBetween(schedule, from, horizon));
  }
  return created;
}
