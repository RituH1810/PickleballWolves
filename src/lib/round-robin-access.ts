import { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Who's "in" a round robin for chat purposes: the organizer, anyone who joined, and anyone already
 * in one of its matches. Group members can also read and post (they can see the game anyway).
 */
export async function roundRobinParticipants(roundRobinId: string) {
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId }, select: { id: true, name: true, createdById: true, groupId: true, rsvps: { where: { status: "JOINED" }, select: { userId: true } }, matches: { where: { deletedAt: null }, select: { players: { select: { userId: true } } } } } });
  if (!roundRobin) return null;
  const participantIds = new Set([roundRobin.createdById, ...roundRobin.rsvps.map((rsvp) => rsvp.userId), ...roundRobin.matches.flatMap((match) => match.players.map((player) => player.userId))]);
  return { roundRobin, participantIds };
}

export async function canUseRoundRobinChat(roundRobinId: string, userId: string) {
  const loaded = await roundRobinParticipants(roundRobinId);
  if (!loaded) return null;
  if (loaded.participantIds.has(userId)) return { ...loaded, isOrganizer: loaded.roundRobin.createdById === userId };
  if (loaded.roundRobin.groupId) {
    const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId: loaded.roundRobin.groupId, userId } } });
    if (membership?.status === MembershipStatus.ACTIVE) return { ...loaded, isOrganizer: false };
  }
  return null;
}
