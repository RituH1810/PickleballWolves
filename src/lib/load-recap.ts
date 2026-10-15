import { prisma } from "@/lib/prisma";
import { computeRecap } from "@/lib/round-robin-recap";

export async function loadRecap(roundRobinId: string) {
  const matches = await prisma.match.findMany({ where: { roundRobinId, deletedAt: null }, include: { players: { include: { user: { select: { id: true, name: true } } } }, scores: { orderBy: { gameNumber: "asc" } } } });
  const ratingDeltas = await prisma.ratingHistory.findMany({ where: { matchId: { in: matches.map((match) => match.id) }, ladderId: null }, select: { userId: true, matchId: true, ratingDelta: true } });
  return computeRecap(
    matches.map((match) => ({ id: match.id, players: match.players.map((player) => ({ userId: player.userId, name: player.user.name, side: player.side })), scores: match.scores })),
    ratingDeltas.map((row) => ({ userId: row.userId, matchId: row.matchId, ratingDelta: Number(row.ratingDelta) })),
  );
}
