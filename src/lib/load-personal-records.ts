import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadMatchDetails } from "@/lib/load-match-details";
import { computePersonalRecords } from "@/lib/personal-records";

/** A player's personal records; with a viewerId, each comes with the match(es) behind it. */
export async function loadPersonalRecords(userId: string, viewerId: string | null) {
  const matches = await prisma.match.findMany({
    where: { status: MatchStatus.COMPLETED, deletedAt: null, players: { some: { userId } } },
    select: { id: true, updatedAt: true, winnerSide: true, roundRobin: { select: { id: true, name: true } }, players: { select: { userId: true, side: true } }, scores: { select: { gameNumber: true, sideAScore: true, sideBScore: true } } },
  });
  const deltas = await prisma.ratingHistory.findMany({ where: { userId, ladderId: null, matchId: { not: null } }, select: { matchId: true, ratingDelta: true } });
  const records = computePersonalRecords(matches.map((match) => ({ ...match, playedAt: match.updatedAt })), userId, new Map(deltas.map((row) => [row.matchId!, Number(row.ratingDelta)])));
  const details = viewerId ? await loadMatchDetails([...new Set(records.flatMap((record) => record.matchIds))], userId, viewerId) : [];
  const detailOf = new Map(details.map((detail) => [detail.id, detail]));
  return {
    records: records.map(({ matchIds, roundRobin, ...record }) => {
      const recordMatches = matchIds.flatMap((id) => detailOf.get(id) ?? []);
      // The night's name comes from its matches, so a private group's stays hidden.
      return { ...record, detail: record.key === "bestNight" && recordMatches[0] && !recordMatches[0].where.href ? record.detail.replace(` at ${roundRobin?.name}`, "") : record.detail, matches: recordMatches };
    }),
  };
}
