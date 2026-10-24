import { prisma } from "@/lib/prisma";
import { computeHallOfFame } from "@/lib/hall-of-fame";

/** A group's all-time records from its ended round robins, with each holder's photo. */
export async function loadHallOfFame(groupId: string) {
  const roundRobins = await prisma.roundRobin.findMany({
    where: { groupId, status: "COMPLETED", matches: { some: { deletedAt: null, scores: { some: {} } } } },
    select: {
      id: true,
      name: true,
      completedAt: true,
      createdAt: true,
      // Every scored match counts, like the recap; updatedAt (when the score was saved) orders them.
      matches: { where: { deletedAt: null, scores: { some: {} } }, select: { id: true, updatedAt: true, players: { select: { userId: true, side: true, user: { select: { name: true, isGuest: true } } } }, scores: { select: { gameNumber: true, sideAScore: true, sideBScore: true } } } },
    },
  });
  const guestIds = new Set(roundRobins.flatMap((roundRobin) => roundRobin.matches.flatMap((match) => match.players.filter((player) => player.user.isGuest).map((player) => player.userId))));
  const records = computeHallOfFame(roundRobins.map((roundRobin) => ({
    id: roundRobin.id,
    name: roundRobin.name,
    endedAt: roundRobin.completedAt ?? roundRobin.createdAt,
    matches: roundRobin.matches.map((match) => ({ id: match.id, playedAt: match.updatedAt, players: match.players.map((player) => ({ userId: player.userId, name: player.user.name, side: player.side })), scores: match.scores })),
  })), guestIds);

  const photos = await prisma.user.findMany({ where: { id: { in: records.flatMap((record) => record.holders.map((holder) => holder.userId)) } }, select: { id: true, photoUrl: true } });
  const photoOf = new Map(photos.map((user) => [user.id, user.photoUrl]));
  return records.map((record) => ({ ...record, holders: record.holders.map((holder) => ({ userId: holder.userId, name: holder.name, photoUrl: photoOf.get(holder.userId) ?? null })) }));
}
