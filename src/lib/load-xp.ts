import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { achievementInfo, winningSide } from "@/lib/achievements";
import { goodWolfResult } from "@/lib/good-wolf";
import { loadRoundRobinWins } from "@/lib/load-recap";
import { isPickle } from "@/lib/pickle";
import { computeXp } from "@/lib/xp";

/** A player's XP, level and where their XP came from. Sources whose table isn't there yet count as 0. */
export async function loadXp(userId: string, now = new Date()) {
  const [matches, titles, goodWolfVotes, nominations, reactions, unlocks] = await Promise.all([
    prisma.match.findMany({ where: { status: MatchStatus.COMPLETED, deletedAt: null, players: { some: { userId } }, scores: { some: {} } }, select: { roundRobinId: true, winnerSide: true, players: { select: { userId: true, side: true } }, scores: { select: { sideAScore: true, sideBScore: true } } } }),
    loadRoundRobinWins(userId),
    prisma.goodWolfVote.count({ where: { voterId: userId } }).catch(() => 0),
    prisma.goodWolfVote.findMany({ where: { nomineeId: userId }, distinct: ["roundRobinId"], select: { roundRobinId: true } }).catch(() => []),
    prisma.reaction.findMany({ where: { userId }, select: { createdAt: true } }).catch(() => []),
    prisma.achievementUnlock.findMany({ where: { userId }, select: { achievementId: true } }),
  ]);

  let wins = 0;
  let pickles = 0;
  for (const match of matches) {
    const side = match.players.find((player) => player.userId === userId)?.side;
    if (!side) continue;
    if (winningSide(match) === side) wins += 1;
    for (const score of match.scores) if (isPickle(side === "A" ? score.sideAScore : score.sideBScore, side === "A" ? score.sideBScore : score.sideAScore)) pickles += 1;
  }

  // Good Wolf awards: only round robins where they got a vote can have crowned them.
  let goodWolfWins = 0;
  if (nominations.length) {
    const nights = await prisma.roundRobin.findMany({ where: { id: { in: nominations.map((row) => row.roundRobinId) }, status: "COMPLETED", completedAt: { not: null } }, select: { id: true, completedAt: true } });
    const votes = await prisma.goodWolfVote.findMany({ where: { roundRobinId: { in: nights.map((night) => night.id) } }, select: { roundRobinId: true, nomineeId: true } }).catch(() => []);
    for (const night of nights) {
      const result = goodWolfResult(votes.filter((vote) => vote.roundRobinId === night.id).map((vote) => vote.nomineeId), night.completedAt!, now);
      if (result.winners.some((winner) => winner.userId === userId)) goodWolfWins += 1;
    }
  }

  return computeXp({
    matches: matches.length,
    wins,
    nights: new Set(matches.map((match) => match.roundRobinId).filter(Boolean)).size,
    titles: titles.length,
    pickles,
    goodWolfVotes,
    goodWolfWins,
    reactionsAt: reactions.map((reaction) => reaction.createdAt),
    badges: unlocks.flatMap((unlock) => { const info = achievementInfo(unlock.achievementId); return info ? [{ tier: info.tier }] : []; }),
  });
}
