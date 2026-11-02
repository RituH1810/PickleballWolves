import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadTitleTimeline } from "@/lib/load-recap";
import { computeNicknames } from "@/lib/nicknames";

const DAY = 24 * 60 * 60 * 1000;

/** A player's nicknames, from every scored match they've played. */
export async function loadNicknames(userId: string, now = new Date()) {
  const [matches, titles, recent] = await Promise.all([
    prisma.match.findMany({
      where: { status: MatchStatus.COMPLETED, deletedAt: null, scores: { some: {} }, players: { some: { userId } } },
      select: { id: true, roundRobinId: true, players: { select: { userId: true, side: true } }, scores: { select: { sideAScore: true, sideBScore: true } } },
    }),
    loadTitleTimeline(userId),
    prisma.ratingHistory.findMany({ where: { userId, ladderId: null, createdAt: { gte: new Date(now.getTime() - 30 * DAY) } }, select: { ratingDelta: true } }),
  ]);
  return computeNicknames({ matches, userId, titles: titles.length, ratingGain30: recent.reduce((total, row) => total + Number(row.ratingDelta), 0) });
}
