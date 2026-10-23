import { MembershipRole, MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { computeAttendance } from "@/lib/attendance";
import { loadGroupAttendance } from "@/lib/load-attendance";
import { buildOrganizerSummary } from "@/lib/organizer-summary";
import { previousWeek } from "@/lib/player-of-the-week";
import { APP_TIME_ZONE } from "@/lib/app-time";

const DAY_MS = 86_400_000;
// Turnout over this window is "usual"; drifting-away is judged over the Insights default.
const BASELINE_WEEKS = 4;
const HISTORY_DAYS = 90;
const TYPE = "ORGANIZER_SUMMARY";

/**
 * Monday: each group's organizers get last week's turnout (vs. the 4 weeks before), the most
 * regular players, who's drifting away, and this week's games with RSVPs so far. Skips a group
 * an organizer already got a summary for this week, so a re-run never doubles up. dryRun builds
 * the summaries without sending anything.
 */
export async function sendOrganizerSummaries(now = new Date(), { dryRun = false } = {}) {
  const week = previousWeek(now);
  const weekAhead = new Date(week.end.getTime() + 7 * DAY_MS);
  const groups = await prisma.group.findMany({
    where: { memberships: { some: { role: MembershipRole.ORGANIZER, status: MembershipStatus.ACTIVE } } },
    select: { id: true, name: true, memberships: { where: { role: MembershipRole.ORGANIZER, status: MembershipStatus.ACTIVE, user: { isGuest: false } }, select: { userId: true } } },
  });

  const results: { group: string; sent: number; title: string | null; body?: string }[] = [];
  for (const group of groups) {
    const [{ games, members }, upcoming] = await Promise.all([
      loadGroupAttendance(group.id, new Date(week.end.getTime() - HISTORY_DAYS * DAY_MS), week.end),
      prisma.roundRobin.findMany({
        where: { groupId: group.id, status: { in: ["SETUP", "LIVE"] }, scheduledAt: { gte: now, lt: weekAhead } },
        orderBy: { scheduledAt: "asc" },
        select: { scheduledAt: true, _count: { select: { rsvps: { where: { status: "JOINED" } } } } },
      }),
    ]);
    const baselineStart = new Date(week.start.getTime() - BASELINE_WEEKS * 7 * DAY_MS);
    const summary = buildOrganizerSummary({
      groupName: group.name,
      lastWeek: games.filter((game) => game.at >= week.start && game.at < week.end),
      baseline: games.filter((game) => game.at >= baselineStart && game.at < week.start),
      memberNames: new Map(members.map((member) => [member.id, member.name])),
      fadingNames: computeAttendance(games, members, now, APP_TIME_ZONE).fading.map((member) => member.name),
      upcoming: upcoming.map((roundRobin) => ({ label: roundRobin.scheduledAt!.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: APP_TIME_ZONE }), joined: roundRobin._count.rsvps })),
    });
    if (!summary) { results.push({ group: group.name, sent: 0, title: null }); continue; }
    if (dryRun) { results.push({ group: group.name, sent: 0, ...summary }); continue; }

    let sent = 0;
    for (const { userId } of group.memberships) {
      const already = await prisma.notification.findFirst({ where: { userId, type: TYPE, title: { startsWith: group.name }, createdAt: { gte: new Date(now.getTime() - 6 * DAY_MS) } }, select: { id: true } });
      if (already) continue;
      await notify(userId, "digest", TYPE, summary.title, summary.body, `/groups/${group.id}/insights`);
      sent += 1;
    }
    results.push({ group: group.name, sent, title: summary.title });
  }
  return { week: week.label, results };
}
