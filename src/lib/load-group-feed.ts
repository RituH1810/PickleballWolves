import { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeGroupFeed, FEED_DAYS } from "@/lib/group-feed";
import { loadGroupRoundRobins } from "@/lib/load-hall-of-fame";
import { summarizeReactions, type ReactionSummary } from "@/lib/reactions";
import { goodWolfClosesAt, goodWolfResult } from "@/lib/good-wolf";

export const feedTarget = (groupId: string, itemId: string) => `${groupId}:${itemId}`;

/**
 * The group's activity feed with each player's photo and every item's reactions for `viewerId`.
 * reactions is null when they can't be loaded (e.g. the Reaction table isn't there yet), so the
 * feed still shows without them.
 */
export async function loadGroupFeed(groupId: string, viewerId: string, now = new Date()) {
  const since = new Date(now.getTime() - FEED_DAYS * 86_400_000);
  const memberships = await prisma.membership.findMany({ where: { groupId, status: MembershipStatus.ACTIVE }, select: { userId: true, joinedAt: true, user: { select: { name: true, photoUrl: true, isGuest: true } } } });
  const people = memberships.filter((membership) => !membership.user.isGuest);
  const memberIds = people.map((membership) => membership.userId);
  const [{ roundRobins }, ratingRows, unlocks, playersOfTheWeek] = await Promise.all([
    loadGroupRoundRobins(groupId),
    // A milestone needs each player's earlier peak, so this is their whole rating history.
    prisma.ratingHistory.findMany({ where: { userId: { in: memberIds }, ladderId: null, matchId: { not: null } }, select: { userId: true, ratingBefore: true, ratingAfter: true, createdAt: true } }),
    prisma.achievementUnlock.findMany({ where: { userId: { in: memberIds }, unlockedAt: { gte: since } }, select: { userId: true, achievementId: true, unlockedAt: true } }),
    prisma.playerOfTheWeek.findMany({ where: { groupId, createdAt: { gte: since } }, select: { userId: true, weekStart: true, createdAt: true } }),
  ]);

  // Good Wolf winners for round robins whose voting closed in the feed's window.
  const recentlyClosed = roundRobins.filter((roundRobin) => goodWolfClosesAt(roundRobin.endedAt) >= since && goodWolfClosesAt(roundRobin.endedAt) <= now);
  const votes = recentlyClosed.length ? await prisma.goodWolfVote.findMany({ where: { roundRobinId: { in: recentlyClosed.map((roundRobin) => roundRobin.id) } }, select: { roundRobinId: true, nomineeId: true } }).catch(() => []) : [];
  const goodWolves = recentlyClosed.map((roundRobin) => ({ roundRobinId: roundRobin.id, name: roundRobin.name, at: goodWolfClosesAt(roundRobin.endedAt), winnerIds: goodWolfResult(votes.filter((vote) => vote.roundRobinId === roundRobin.id).map((vote) => vote.nomineeId), roundRobin.endedAt, now).winners.map((winner) => winner.userId) }));

  const items = computeGroupFeed({
    goodWolves,
    roundRobins,
    ratingRows: ratingRows.map((row) => ({ userId: row.userId, ratingBefore: Number(row.ratingBefore), ratingAfter: Number(row.ratingAfter), createdAt: row.createdAt })),
    unlocks,
    playersOfTheWeek,
    joins: people.flatMap((membership) => membership.joinedAt ? [{ userId: membership.userId, joinedAt: membership.joinedAt }] : []),
    members: new Map(people.map((membership) => [membership.userId, membership.user.name])),
    now,
  });

  let reactions: Record<string, ReactionSummary> | null = null;
  try {
    const rows = await prisma.reaction.findMany({ where: { targetType: "FEED", targetId: { in: items.map((item) => feedTarget(groupId, item.id)) } }, select: { targetId: true, userId: true, emoji: true, createdAt: true } });
    const reactors = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.userId))] } }, select: { id: true, name: true } });
    const nameOf = new Map(reactors.map((person) => [person.id, person.name]));
    reactions = Object.fromEntries(items.map((item) => [item.id, summarizeReactions(rows.filter((row) => row.targetId === feedTarget(groupId, item.id)), nameOf, viewerId)]));
  } catch { /* reactions unavailable -- show the feed without them */ }

  const photoOf = new Map(people.map((membership) => [membership.userId, membership.user.photoUrl]));
  return { items: items.map((item) => ({ ...item, players: item.players.map((player) => ({ ...player, photoUrl: photoOf.get(player.userId) ?? null })) })), reactions };
}
