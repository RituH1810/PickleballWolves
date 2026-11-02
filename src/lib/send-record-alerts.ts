import { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { computeHallOfFame } from "@/lib/hall-of-fame";
import { loadGroupRoundRobins } from "@/lib/load-hall-of-fame";
import { brokenRecords, recordMessage } from "@/lib/record-alerts";

/**
 * After a group round robin ends, tells every member about any Hall of Fame record it broke
 * (compared with the Hall of Fame without that night). Each record is announced once per night.
 */
export async function sendRecordAlerts(roundRobinId: string) {
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId }, select: { groupId: true, group: { select: { name: true } } } });
  if (!roundRobin?.groupId || !roundRobin.group) return { sent: 0 };
  const { roundRobins, guestIds } = await loadGroupRoundRobins(roundRobin.groupId);
  if (!roundRobins.some((entry) => entry.id === roundRobinId)) return { sent: 0 };
  const broken = brokenRecords(computeHallOfFame(roundRobins.filter((entry) => entry.id !== roundRobinId), guestIds), computeHallOfFame(roundRobins, guestIds));
  if (!broken.length) return { sent: 0 };

  const members = await prisma.membership.findMany({ where: { groupId: roundRobin.groupId, status: MembershipStatus.ACTIVE }, select: { userId: true } });
  let sent = 0;
  for (const entry of broken) {
    const type = `RECORD_${roundRobinId}_${entry.record.key}`;
    const already = new Set((await prisma.notification.findMany({ where: { type }, select: { userId: true } })).map((row) => row.userId));
    const { title, body } = recordMessage(entry, roundRobin.group.name);
    for (const { userId } of members) {
      if (already.has(userId)) continue;
      await notify(userId, "achievement", type, title, body, `/groups/${roundRobin.groupId}/hall-of-fame`);
      sent += 1;
    }
  }
  return { sent };
}
