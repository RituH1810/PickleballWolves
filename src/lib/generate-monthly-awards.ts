import { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { zonedParts, zonedTimeToUtc } from "@/lib/recurring";
import { AWARD_LABELS, awardsAnnouncement, computeMonthlyAwards, monthLabel } from "@/lib/monthly-awards";

// Month boundaries follow the groups' local calendar, not UTC.
export const AWARDS_TIME_ZONE = "America/New_York";

/** The calendar month before `now`: its "YYYY-MM" key and UTC start/end instants. */
export function previousMonth(now = new Date(), timeZone = AWARDS_TIME_ZONE) {
  const local = zonedParts(now, timeZone);
  const year = local.month === 1 ? local.year - 1 : local.year;
  const month = local.month === 1 ? 12 : local.month - 1;
  return {
    month: `${year}-${String(month).padStart(2, "0")}`,
    start: zonedTimeToUtc(year, month, 1, 0, 0, timeZone),
    end: zonedTimeToUtc(local.year, local.month, 1, 0, 0, timeZone),
  };
}

/**
 * Works out every group's awards for one month, saves them, posts them as a group announcement,
 * and tells each winner. A group that already has awards for the month is skipped, so re-running
 * (or a retried cron) never double-announces.
 */
export async function generateMonthlyAwards(period = previousMonth()) {
  const groups = await prisma.group.findMany({ select: { id: true, name: true, createdById: true } });
  const results: { group: string; awards: number }[] = [];

  for (const group of groups) {
    if (await prisma.monthlyAward.count({ where: { groupId: group.id, month: period.month } })) continue;

    const matches = await prisma.match.findMany({
      where: { deletedAt: null, status: "COMPLETED", roundRobin: { groupId: group.id }, updatedAt: { gte: period.start, lt: period.end }, scores: { some: {} } },
      include: { players: { include: { user: { select: { name: true } } } }, scores: true },
    });
    if (!matches.length) continue;
    const ratingDeltas = await prisma.ratingHistory.findMany({ where: { matchId: { in: matches.map((match) => match.id) }, ladderId: null }, select: { userId: true, matchId: true, ratingDelta: true } });
    const awards = computeMonthlyAwards(
      matches.map((match) => ({ id: match.id, players: match.players.map((player) => ({ userId: player.userId, name: player.user.name, side: player.side })), scores: match.scores })),
      ratingDeltas.map((row) => ({ userId: row.userId, matchId: row.matchId, ratingDelta: Number(row.ratingDelta) })),
    );
    if (!awards.length) continue;

    const saved = await prisma.monthlyAward.createMany({ data: awards.map((award) => ({ groupId: group.id, month: period.month, award: award.award, userId: award.userId, partnerId: award.partnerId, value: award.value, detail: award.detail })), skipDuplicates: true });
    if (!saved.count) continue;

    const { title, body } = awardsAnnouncement(period.month, awards);
    await prisma.announcement.create({ data: { groupId: group.id, authorId: group.createdById, title, body } });
    const members = await prisma.membership.findMany({ where: { groupId: group.id, status: MembershipStatus.ACTIVE }, select: { userId: true } });
    const winners = new Map<string, string[]>();
    for (const award of awards) winners.set(award.userId, [...(winners.get(award.userId) ?? []), AWARD_LABELS[award.award].title]);
    await Promise.all(members.map((member) => {
      const won = winners.get(member.userId);
      return won
        ? notify(member.userId, "general", "MONTHLY_AWARD", `You won ${won.join(" and ")}!`, `${group.name}'s ${monthLabel(period.month)} awards are out -- yours is on your profile.`)
        : notify(member.userId, "general", "GROUP_ANNOUNCEMENT", `${group.name}: ${title}`, body.split("\n")[0]);
    }));
    results.push({ group: group.name, awards: saved.count });
  }
  return { month: period.month, results };
}
