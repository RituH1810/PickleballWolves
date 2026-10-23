import { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Who's "in" a round robin for chat purposes: the organizer, anyone who joined, and anyone already
 * in one of its matches. Group members can also read and post (they can see the game anyway).
 */
export async function roundRobinParticipants(roundRobinId: string) {
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId }, select: { id: true, name: true, createdById: true, coHostIds: true, groupId: true, rsvps: { where: { status: "JOINED" }, select: { userId: true } }, matches: { where: { deletedAt: null }, select: { players: { select: { userId: true } } } } } });
  if (!roundRobin) return null;
  const participantIds = new Set([roundRobin.createdById, ...roundRobin.coHostIds, ...roundRobin.rsvps.map((rsvp) => rsvp.userId), ...roundRobin.matches.flatMap((match) => match.players.map((player) => player.userId))]);
  return { roundRobin, participantIds };
}

export async function canUseRoundRobinChat(roundRobinId: string, userId: string) {
  const loaded = await roundRobinParticipants(roundRobinId);
  if (!loaded) return null;
  if (loaded.participantIds.has(userId)) return { ...loaded, isOrganizer: await canRunRoundRobin(loaded.roundRobin, userId) };
  if (loaded.roundRobin.groupId) {
    const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId: loaded.roundRobin.groupId, userId } } });
    if (membership?.status === MembershipStatus.ACTIVE) return { ...loaded, isOrganizer: membership.role === "ORGANIZER" };
  }
  return null;
}

/**
 * True if the player is in this round robin: joined (including players from outside the group the
 * organizer added) or already in one of its matches. Lets non-members see a game they're playing in.
 */
export async function isRoundRobinParticipant(roundRobinId: string, userId: string) {
  const [rsvp, match] = await Promise.all([
    prisma.roundRobinRSVP.findFirst({ where: { roundRobinId, userId, status: "JOINED" }, select: { id: true } }),
    prisma.match.findFirst({ where: { roundRobinId, deletedAt: null, players: { some: { userId } } }, select: { id: true } }),
  ]);
  return Boolean(rsvp || match);
}

type RunnableRoundRobin = { createdById: string; coHostIds: string[]; groupId: string | null };

/**
 * Who can run a round robin on game day -- manage players, rounds, matches, and scores, and end it:
 * its organizer, co-hosts they picked, and (for group games) the group's organizers. Editing the
 * settings or deleting it stays with the organizer.
 */
export async function canRunRoundRobin(roundRobin: RunnableRoundRobin, userId: string) {
  if (roundRobin.createdById === userId || roundRobin.coHostIds.includes(userId)) return true;
  if (!roundRobin.groupId) return false;
  const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId: roundRobin.groupId, userId } }, select: { status: true, role: true } });
  return membership?.status === MembershipStatus.ACTIVE && membership.role === "ORGANIZER";
}
