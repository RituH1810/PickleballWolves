import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeClutch } from "@/lib/clutch";
import { computePartners } from "@/lib/partners";
import { computeRivalry, findTopRival, type RivalryMatch } from "@/lib/rivalry";

const MATCH_SELECT = {
  id: true,
  updatedAt: true,
  players: { select: { userId: true, side: true, user: { select: { name: true } } } },
  scores: { orderBy: { gameNumber: "asc" as const }, select: { sideAScore: true, sideBScore: true } },
  event: { select: { title: true } },
  roundRobin: { select: { name: true } },
  tournamentGroup: { select: { tournament: { select: { name: true } } } },
  leagueDivision: { select: { season: { select: { league: { select: { name: true } } } } } },
};

type LoadedMatch = { id: string; updatedAt: Date; players: { userId: string; side: "A" | "B"; user: { name: string } }[]; scores: { sideAScore: number; sideBScore: number }[]; event: { title: string } | null; roundRobin: { name: string } | null; tournamentGroup: { tournament: { name: string } } | null; leagueDivision: { season: { league: { name: string } } } | null };

function toRivalryMatch(match: LoadedMatch): RivalryMatch {
  return {
    id: match.id,
    playedAt: match.updatedAt,
    event: match.roundRobin?.name ?? match.tournamentGroup?.tournament.name ?? match.leagueDivision?.season.league.name ?? match.event?.title ?? "Recorded match",
    players: match.players.map((player) => ({ userId: player.userId, name: player.user.name, side: player.side })),
    scores: match.scores,
  };
}

/** Everything about two players' rivalry, or null if either player doesn't exist. */
export async function loadRivalry(a: string, b: string) {
  const [playerA, playerB] = await Promise.all([a, b].map((id) => prisma.user.findUnique({ where: { id }, select: { id: true, name: true, photoUrl: true, skillRating: true } })));
  if (!playerA || !playerB) return null;
  const matches = await prisma.match.findMany({
    where: { status: MatchStatus.COMPLETED, deletedAt: null, AND: [{ players: { some: { userId: a } } }, { players: { some: { userId: b } } }] },
    select: MATCH_SELECT,
  });
  const rivalry = computeRivalry((matches as LoadedMatch[]).map(toRivalryMatch), a, b);
  const person = (player: typeof playerA) => ({ id: player.id, name: player.name, photoUrl: player.photoUrl, skillRating: Number(player.skillRating) });
  return { a: person(playerA), b: person(playerB), ...rivalry };
}

/** The player's most-faced opponent and their record against them (null until they've met someone enough). */
export async function loadTopRival(userId: string) {
  const matches = await prisma.match.findMany({ where: { status: MatchStatus.COMPLETED, deletedAt: null, players: { some: { userId } } }, select: MATCH_SELECT });
  const rival = findTopRival((matches as LoadedMatch[]).map(toRivalryMatch), userId);
  if (!rival) return null;
  const photo = await prisma.user.findUnique({ where: { id: rival.userId }, select: { photoUrl: true } });
  return { ...rival, photoUrl: photo?.photoUrl ?? null };
}

/** Partner chemistry: the player's record with each partner and their best partner, with photos. */
export async function loadPartners(userId: string) {
  const matches = await prisma.match.findMany({ where: { status: MatchStatus.COMPLETED, deletedAt: null, players: { some: { userId } } }, select: MATCH_SELECT });
  const { best, partners } = computePartners((matches as LoadedMatch[]).map(toRivalryMatch), userId);
  const photos = await prisma.user.findMany({ where: { id: { in: partners.map((partner) => partner.userId) } }, select: { id: true, photoUrl: true } });
  const photoOf = new Map(photos.map((user) => [user.id, user.photoUrl]));
  const withPhoto = <T extends { userId: string }>(partner: T) => ({ ...partner, photoUrl: photoOf.get(partner.userId) ?? null });
  return { best: best && withPhoto(best), partners: partners.map(withPhoto) };
}

/** Clutch stats: close games, underdog matches and upsets (from the ratings everyone had going in), and comebacks. */
export async function loadClutch(userId: string) {
  const matches = await prisma.match.findMany({ where: { status: MatchStatus.COMPLETED, deletedAt: null, players: { some: { userId } } }, select: MATCH_SELECT });
  const rows = await prisma.ratingHistory.findMany({ where: { matchId: { in: matches.map((match) => match.id) }, ladderId: null }, select: { matchId: true, userId: true, ratingBefore: true } });
  const ratingBefore = new Map(rows.map((row) => [`${row.matchId}:${row.userId}`, Number(row.ratingBefore)]));
  return computeClutch((matches as LoadedMatch[]).map(toRivalryMatch), userId, ratingBefore);
}
