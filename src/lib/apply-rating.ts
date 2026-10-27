import { prisma } from "@/lib/prisma";
import { MAX_RATING, MIN_RATING } from "@/lib/match-prediction";
import { matchResult, rateMatch, RATING_DECIMALS, type RatingChange } from "@/lib/rating";

const round = (value: number) => Math.round(value * 10 ** RATING_DECIMALS) / 10 ** RATING_DECIMALS;

/**
 * Brings one match's rating change in line with its current scores: undoes whatever change it
 * already made, then applies the right one (none if the match is deleted, unscored or level).
 * Called on every score save, so a corrected score -- even one that flips the winner -- re-rates
 * the match instead of keeping the first result, and on delete, so a deleted match stops counting.
 * The expectation uses the ratings players had going into the match the first time.
 */
export async function rerateMatch(matchId: string): Promise<RatingChange[]> {
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { deletedAt: true, players: { select: { userId: true, side: true } }, scores: { select: { sideAScore: true, sideBScore: true } } } });
  if (!match) return [];
  const playerIds = match.players.map((player) => player.userId);
  const [previous, users] = await Promise.all([
    prisma.ratingHistory.findMany({ where: { matchId, ladderId: null } }),
    prisma.user.findMany({ where: { id: { in: playerIds } }, select: { id: true, skillRating: true } }),
  ]);
  // Rated matches each player had before this one (before its first rating, if it has one), so
  // re-saving the same score gives the same change.
  const firstRatedAt = previous.length ? new Date(Math.min(...previous.map((row) => row.createdAt.getTime()))) : null;
  const otherRated = await prisma.ratingHistory.groupBy({ by: ["userId"], where: { userId: { in: playerIds }, ladderId: null, matchId: { not: null }, NOT: { matchId }, ...(firstRatedAt ? { createdAt: { lt: firstRatedAt } } : {}) }, _count: { _all: true } });
  const previousByUser = new Map(previous.map((row) => [row.userId, row]));
  const currentById = new Map(users.map((user) => [user.id, Number(user.skillRating)]));
  const ratedById = new Map(otherRated.map((row) => [row.userId, row._count._all]));

  const result = match.deletedAt ? null : matchResult(match.scores);
  const side = (letter: "A" | "B") => match.players
    .filter((player) => player.side === letter && currentById.has(player.userId))
    .map((player) => {
      const earlier = previousByUser.get(player.userId);
      return { userId: player.userId, rating: earlier ? Number(earlier.ratingBefore) : currentById.get(player.userId)!, ratedMatches: ratedById.get(player.userId) ?? 0 };
    });
  const changes = result ? rateMatch(side("A"), side("B"), result) : [];
  const changeByUser = new Map(changes.map((change) => [change.userId, change]));

  const writes = [...new Set([...previousByUser.keys(), ...changeByUser.keys()])].filter((userId) => currentById.has(userId)).flatMap((userId) => {
    const earlier = previousByUser.get(userId);
    const change = changeByUser.get(userId);
    const oldDelta = earlier ? Number(earlier.ratingDelta) : 0;
    const newDelta = change?.delta ?? 0;
    const next = round(Math.min(MAX_RATING, Math.max(MIN_RATING, currentById.get(userId)! - oldDelta + newDelta)));
    const history = earlier && change ? [prisma.ratingHistory.update({ where: { id: earlier.id }, data: { ratingBefore: change.before, ratingAfter: change.after, ratingDelta: change.delta } })]
      : earlier ? [prisma.ratingHistory.delete({ where: { id: earlier.id } })]
      : change ? [prisma.ratingHistory.create({ data: { userId, matchId, ratingBefore: change.before, ratingAfter: change.after, ratingDelta: change.delta } })]
      : [];
    return [...(next !== currentById.get(userId) ? [prisma.user.update({ where: { id: userId }, data: { skillRating: next } })] : []), ...history];
  });
  if (writes.length) await prisma.$transaction(writes);
  return changes;
}
