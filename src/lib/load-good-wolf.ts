import { prisma } from "@/lib/prisma";
import { goodWolfResult } from "@/lib/good-wolf";

/** Who can vote and be voted for: account holders (not guests) who played a scored match in the round robin. */
async function players(roundRobinId: string) {
  const rows = await prisma.matchPlayer.findMany({ where: { match: { roundRobinId, deletedAt: null, scores: { some: {} } }, user: { isGuest: false } }, select: { user: { select: { id: true, name: true, photoUrl: true } } } });
  return [...new Map(rows.map((row) => [row.user.id, row.user])).values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The Good Wolf vote for a round robin as `viewerId` sees it: while open, whether they can vote,
 * who they can pick and their own vote (no one else's, and no running tally); once closed, the winners.
 * Null before the round robin has ended.
 */
export async function loadGoodWolf(roundRobinId: string, viewerId: string | null, now = new Date()) {
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId }, select: { status: true, completedAt: true } });
  if (!roundRobin || roundRobin.status !== "COMPLETED" || !roundRobin.completedAt) return null;
  const [everyone, votes] = await Promise.all([players(roundRobinId), prisma.goodWolfVote.findMany({ where: { roundRobinId }, select: { voterId: true, nomineeId: true } })]);
  const result = goodWolfResult(votes.map((vote) => vote.nomineeId), roundRobin.completedAt, now);
  const canVote = result.open && Boolean(viewerId) && everyone.some((player) => player.id === viewerId);
  const personOf = new Map(everyone.map((player) => [player.id, player]));
  return {
    open: result.open,
    closesAt: result.closesAt,
    totalVotes: result.totalVotes,
    canVote,
    candidates: canVote ? everyone.filter((player) => player.id !== viewerId) : [],
    myVote: canVote ? votes.find((vote) => vote.voterId === viewerId)?.nomineeId ?? null : null,
    winners: result.winners.flatMap((winner) => personOf.has(winner.userId) ? [{ ...personOf.get(winner.userId)!, votes: winner.votes }] : []),
  };
}

/** Records (or changes) a player's vote. Returns an error message when it isn't allowed. */
export async function castGoodWolfVote(roundRobinId: string, voterId: string, nomineeId: string): Promise<string | null> {
  const state = await loadGoodWolf(roundRobinId, voterId);
  if (!state) return "Voting opens once the round robin has ended.";
  if (!state.open) return "Voting for this round robin has closed.";
  if (!state.canVote) return "Only players from this round robin can vote.";
  if (!state.candidates.some((player) => player.id === nomineeId)) return "Pick another player from this round robin.";
  await prisma.goodWolfVote.upsert({ where: { roundRobinId_voterId: { roundRobinId, voterId } }, create: { roundRobinId, voterId, nomineeId }, update: { nomineeId } });
  return null;
}
