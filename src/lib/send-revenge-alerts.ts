import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { findRematches, opponentKey, revengeMessage } from "@/lib/revenge";

/**
 * After a round robin's matches are scheduled, tells each player which of their upcoming matches
 * are against the opponents who beat them last time -- one push per player. Each opponent side
 * is only called out once per round robin, so regenerating or adding rounds never repeats one.
 */
export async function sendRevengeAlerts(roundRobinId: string) {
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId }, select: { name: true } });
  if (!roundRobin) return { sent: 0 };
  const upcoming = await prisma.match.findMany({
    where: { roundRobinId, deletedAt: null, scores: { none: {} } },
    select: { id: true, players: { select: { userId: true, side: true, user: { select: { name: true, isGuest: true } } } } },
  });
  const names = new Map(upcoming.flatMap((match) => match.players.map((player) => [player.userId, player.user.name] as const)));
  const playerIds = [...new Set(upcoming.flatMap((match) => match.players.filter((player) => !player.user.isGuest).map((player) => player.userId)))];
  if (!playerIds.length) return { sent: 0 };

  const history = await prisma.match.findMany({
    where: { status: MatchStatus.COMPLETED, deletedAt: null, scores: { some: {} }, players: { some: { userId: { in: playerIds } } } },
    select: { id: true, updatedAt: true, winnerSide: true, players: { select: { userId: true, side: true } }, scores: { select: { gameNumber: true, sideAScore: true, sideBScore: true } } },
  });
  const typePrefix = `REVENGE_${roundRobinId}_`;
  const alreadySent = await prisma.notification.findMany({ where: { userId: { in: playerIds }, type: { startsWith: typePrefix } }, select: { userId: true, type: true } });
  // The type lists every opponent side the push covered: REVENGE_<event>_<a,b>;<c,d>.
  const sentKeys = new Set(alreadySent.flatMap((row) => row.type.slice(typePrefix.length).split(";").map((key) => `${row.userId}:${key}`)));
  const pastMatches = history.map((match) => ({ ...match, playedAt: match.updatedAt }));
  const upcomingMatches = upcoming.map((match) => ({ id: match.id, players: match.players.map(({ userId, side }) => ({ userId, side })) }));

  let sent = 0;
  for (const userId of playerIds) {
    const mine = pastMatches.filter((match) => match.players.some((player) => player.userId === userId));
    const fresh = findRematches(upcomingMatches, mine, userId).filter((rematch) => !sentKeys.has(`${userId}:${opponentKey(rematch.opponentIds)}`));
    if (!fresh.length) continue;
    const { title, body } = revengeMessage(fresh, names, roundRobin.name);
    await notify(userId, "challenge", `${typePrefix}${fresh.map((rematch) => opponentKey(rematch.opponentIds)).join(";")}`, title, body, `/round-robin/${roundRobinId}`);
    sent += 1;
  }
  return { sent };
}
