import { MembershipRole, MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS } from "@/lib/poll-limits";

/** The signed-in player and their active membership in the group (null if not a member). */
export async function pollViewer(groupId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  return { userId: user.id, isMember: membership?.status === MembershipStatus.ACTIVE, isOrganizer: membership?.status === MembershipStatus.ACTIVE && membership.role === MembershipRole.ORGANIZER };
}

/** A poll with its options, who voted for each, and what the viewer picked. */
export async function loadPoll(pollId: string, viewerId: string) {
  const poll = await prisma.availabilityPoll.findUnique({ where: { id: pollId }, include: { options: { orderBy: { startsAt: "asc" }, include: { votes: { select: { userId: true } } } } } });
  if (!poll) return null;
  const voterIds = [...new Set([poll.createdById, ...poll.options.flatMap((option) => option.votes.map((vote) => vote.userId))])];
  const people = new Map((await prisma.user.findMany({ where: { id: { in: voterIds } }, select: { id: true, name: true } })).map((person) => [person.id, person.name]));
  const best = Math.max(0, ...poll.options.map((option) => option.votes.length));
  return {
    id: poll.id,
    question: poll.question,
    status: poll.status,
    timeZone: poll.timeZone,
    createdAt: poll.createdAt,
    createdByName: people.get(poll.createdById) ?? "Organizer",
    scheduledRoundRobinId: poll.scheduledRoundRobinId,
    voterCount: new Set(poll.options.flatMap((option) => option.votes.map((vote) => vote.userId))).size,
    options: poll.options.map((option) => ({
      id: option.id,
      startsAt: option.startsAt,
      votes: option.votes.length,
      voters: option.votes.map((vote) => people.get(vote.userId) ?? "Player"),
      mine: option.votes.some((vote) => vote.userId === viewerId),
      leading: best > 0 && option.votes.length === best,
    })),
  };
}
