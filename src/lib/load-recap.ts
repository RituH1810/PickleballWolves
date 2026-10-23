import { prisma } from "@/lib/prisma";
import { computePlayerRecap, computeRecap, type RecapMatch } from "@/lib/round-robin-recap";

/** How long a personal recap stays on the dashboard after its round robin ends. */
export const PERSONAL_RECAP_HOURS = 24;

async function loadMatches(roundRobinIds: string[]) {
  const matches = await prisma.match.findMany({ where: { roundRobinId: { in: roundRobinIds }, deletedAt: null }, include: { players: { include: { user: { select: { id: true, name: true } } } }, scores: { orderBy: { gameNumber: "asc" } } } });
  const ratingDeltas = await prisma.ratingHistory.findMany({ where: { matchId: { in: matches.map((match) => match.id) }, ladderId: null }, select: { userId: true, matchId: true, ratingDelta: true, ratingBefore: true } });
  const byRoundRobin = new Map<string, RecapMatch[]>();
  for (const match of matches) {
    const list = byRoundRobin.get(match.roundRobinId!) ?? [];
    list.push({ id: match.id, players: match.players.map((player) => ({ userId: player.userId, name: player.user.name, side: player.side })), scores: match.scores });
    byRoundRobin.set(match.roundRobinId!, list);
  }
  return { byRoundRobin, ratingDeltas: ratingDeltas.map((row) => ({ userId: row.userId, matchId: row.matchId, ratingDelta: Number(row.ratingDelta), ratingBefore: Number(row.ratingBefore) })) };
}

export async function loadRecap(roundRobinId: string) {
  const { byRoundRobin, ratingDeltas } = await loadMatches([roundRobinId]);
  return computeRecap(byRoundRobin.get(roundRobinId) ?? [], ratingDeltas);
}

/** Every player's personal recap for one round robin, keyed by user id (players with no scored game are left out). */
export async function loadPlayerRecaps(roundRobinId: string) {
  const { byRoundRobin, ratingDeltas } = await loadMatches([roundRobinId]);
  const matches = byRoundRobin.get(roundRobinId) ?? [];
  const userIds = new Set(matches.flatMap((match) => match.players.map((player) => player.userId)));
  const recaps = new Map<string, NonNullable<ReturnType<typeof computePlayerRecap>>>();
  for (const userId of userIds) {
    const recap = computePlayerRecap(matches, userId, ratingDeltas);
    if (recap) recaps.set(userId, recap);
  }
  return recaps;
}

/** The signed-in player's recaps for round robins that ended in the last PERSONAL_RECAP_HOURS. */
export async function loadRecentPersonalRecaps(userId: string, now = new Date()) {
  const since = new Date(now.getTime() - PERSONAL_RECAP_HOURS * 3_600_000);
  const roundRobins = await prisma.roundRobin.findMany({
    where: { status: "COMPLETED", completedAt: { gte: since }, matches: { some: { deletedAt: null, players: { some: { userId } }, scores: { some: {} } } } },
    orderBy: { completedAt: "desc" },
    select: { id: true, name: true, completedAt: true, group: { select: { name: true } } },
  });
  if (!roundRobins.length) return [];
  const { byRoundRobin, ratingDeltas } = await loadMatches(roundRobins.map((roundRobin) => roundRobin.id));
  return roundRobins.flatMap((roundRobin) => {
    const recap = computePlayerRecap(byRoundRobin.get(roundRobin.id) ?? [], userId, ratingDeltas);
    return recap ? [{ roundRobinId: roundRobin.id, name: roundRobin.name, groupName: roundRobin.group?.name ?? null, completedAt: roundRobin.completedAt!, expiresAt: new Date(roundRobin.completedAt!.getTime() + PERSONAL_RECAP_HOURS * 3_600_000), recap }] : [];
  });
}

/** When each ended round robin this player won (finished first; co-champions all count) was ended. */
export async function loadRoundRobinWins(userId: string) {
  const roundRobins = await prisma.roundRobin.findMany({
    where: { status: "COMPLETED", matches: { some: { deletedAt: null, players: { some: { userId } }, scores: { some: {} } } } },
    select: { id: true, completedAt: true, createdAt: true },
  });
  if (!roundRobins.length) return [];
  const { byRoundRobin } = await loadMatches(roundRobins.map((roundRobin) => roundRobin.id));
  return roundRobins.flatMap((roundRobin) => {
    const recap = computeRecap(byRoundRobin.get(roundRobin.id) ?? []);
    return recap?.champions.some((entry) => entry.userId === userId) ? [roundRobin.completedAt ?? roundRobin.createdAt] : [];
  });
}
