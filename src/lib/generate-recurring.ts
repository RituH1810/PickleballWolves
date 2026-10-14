import { MembershipRole, MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { GENERATE_AHEAD_DAYS, occurrenceName, occurrencesBetween } from "@/lib/recurring";

/**
 * Turns every schedule's occurrences in the next GENERATE_AHEAD_DAYS into regular group round
 * robins, created and announced exactly like a hand-made one. Safe to run as often as you like:
 * each schedule's window is claimed (generatedThrough) before anything is created, so overlapping
 * runs can't double-create, and a game an organizer deletes stays deleted.
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
    const occurrences = occurrencesBetween(schedule, from, horizon);
    if (!occurrences.length) continue;

    const [organizer, members] = await Promise.all([
      prisma.user.findUnique({ where: { id: schedule.createdById }, select: { name: true } }),
      prisma.membership.findMany({ where: { groupId: schedule.groupId, status: MembershipStatus.ACTIVE, userId: { not: schedule.createdById } }, select: { userId: true } }),
    ]);

    for (const scheduledAt of occurrences) {
      const name = occurrenceName(schedule.group.name, scheduledAt, schedule.timeZone);
      // Same defaults as POST /api/round-robin.
      await prisma.roundRobin.create({ data: { name, createdById: schedule.createdById, groupId: schedule.groupId, scheduledAt, format: "POPCORN", partnerFormat: schedule.partnerFormat, playFormat: schedule.playFormat, courtCount: schedule.courtCount, roundCount: 4, pointsToWin: schedule.pointsToWin, winBy: schedule.winBy, recurringScheduleId: schedule.id } });
      await Promise.all(members.map((member) => notify(member.userId, "general", "ROUND_ROBIN_CREATED", `New game in ${schedule.group.name}`, `${organizer?.name ?? "An organizer"} scheduled ${name}. Check your invites to join or pass.`)));
      created += 1;
    }
  }
  return created;
}
