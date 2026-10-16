import { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { occurrenceName } from "@/lib/recurring";

type Options = {
  group: { id: string; name: string };
  organizer: { id: string; name: string };
  scheduledAt: Date;
  timeZone: string;
  playFormat: string;
  partnerFormat: string;
  courtCount: number;
  pointsToWin: number;
  /** Players joined straight away (e.g. everyone who said this time works). */
  joinIds: string[];
  joinedReason: string;
};

/**
 * A group round robin created the same way as a hand-made one (same name, defaults, and invites),
 * with some members already in: they're told they're in, everyone else gets the usual invite.
 */
export async function createGroupRoundRobin(options: Options) {
  const { group, organizer, scheduledAt } = options;
  const name = occurrenceName(group.name, scheduledAt, options.timeZone);
  const members = await prisma.membership.findMany({ where: { groupId: group.id, status: MembershipStatus.ACTIVE }, select: { userId: true } });
  const memberIds = new Set(members.map((member) => member.userId));
  const joinIds = [...new Set(options.joinIds)].filter((userId) => memberIds.has(userId));

  const roundRobin = await prisma.roundRobin.create({ data: { name, createdById: organizer.id, groupId: group.id, scheduledAt, format: "POPCORN", partnerFormat: options.partnerFormat, playFormat: options.playFormat, courtCount: options.courtCount, roundCount: 4, pointsToWin: options.pointsToWin, winBy: 1 } });
  if (joinIds.length) await prisma.roundRobinRSVP.createMany({ data: joinIds.map((userId) => ({ roundRobinId: roundRobin.id, userId, status: "JOINED" as const })) });

  const url = `/round-robin/${roundRobin.id}`;
  await Promise.all([...memberIds].filter((userId) => userId !== organizer.id).map((userId) => joinIds.includes(userId)
    ? notify(userId, "general", "ROUND_ROBIN_AUTO_JOINED", `You're in: ${name}`, `${options.joinedReason} Decline from the game page if plans change.`, url)
    : notify(userId, "general", "ROUND_ROBIN_CREATED", `New game in ${group.name}`, `${organizer.name} scheduled ${name}. Check your invites to join or pass.`, url)));
  return roundRobin;
}
