import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { assetUrl } from "@/lib/branding";
import { bracketRoundLabel, computeTeamStandings } from "@/lib/tournament";

type Team = { members: { user: { name: string } }[] } | null;
const teamName = (team: Team) => team?.members.map((member) => member.user.name).join(" / ") || "TBD";

/**
 * A public tournament page's data, by its /t/<slug> link -- only while the organizer has the
 * public page turned on. Shows what spectators need (teams, scores, standings, bracket) and
 * nothing private (no emails or ratings). Cached per request so the page and its metadata share it.
 */
export const loadPublicTournament = cache(async (slug: string) => {
  const tournament = await prisma.tournament.findFirst({
    where: { publicSlug: slug, isPublic: true },
    include: {
      createdBy: { select: { name: true } },
      sponsors: { orderBy: { position: "asc" } },
      _count: { select: { entrants: true, teams: true } },
      pools: {
        orderBy: { name: "asc" },
        include: {
          teams: { include: { members: { include: { user: { select: { name: true } } } } } },
          matches: { where: { deletedAt: null }, orderBy: [{ courtNumber: "asc" }, { createdAt: "asc" }], include: { scores: { orderBy: { gameNumber: "asc" } } } },
        },
      },
      bracketMatches: {
        orderBy: [{ round: "asc" }, { position: "asc" }],
        include: {
          teamA: { include: { members: { include: { user: { select: { name: true } } } } } },
          teamB: { include: { members: { include: { user: { select: { name: true } } } } } },
          match: { include: { scores: { orderBy: { gameNumber: "asc" } } } },
        },
      },
    },
  });
  if (!tournament) return null;

  const pools = tournament.pools.map((pool) => {
    const nameById = new Map(pool.teams.map((team) => [team.id, teamName(team)]));
    return {
      id: pool.id,
      name: pool.name,
      standings: computeTeamStandings(pool.teams.map((team) => team.id), pool.matches).map((entry) => ({ ...entry, teamName: nameById.get(entry.teamId) ?? "TBD" })),
      matches: pool.matches.map((match) => ({
        id: match.id,
        court: match.courtNumber,
        teamA: nameById.get(match.tournamentTeamAId ?? "") ?? "TBD",
        teamB: nameById.get(match.tournamentTeamBId ?? "") ?? "TBD",
        winnerSide: match.winnerSide,
        scores: match.scores.map((score) => [score.sideAScore, score.sideBScore] as const),
      })),
    };
  });

  const totalRounds = Math.max(0, ...tournament.bracketMatches.map((match) => match.round));
  const rounds = Array.from({ length: totalRounds }, (_, index) => index + 1).map((round) => ({
    round,
    label: bracketRoundLabel(round, totalRounds),
    matches: tournament.bracketMatches.filter((match) => match.round === round).map((match) => ({
      id: match.id,
      teamA: teamName(match.teamA),
      teamB: teamName(match.teamB),
      winnerSide: match.match?.winnerSide ?? null,
      scores: match.match?.scores.map((score) => [score.sideAScore, score.sideBScore] as const) ?? [],
    })),
  }));
  const final = rounds.at(-1)?.matches.length === 1 ? rounds.at(-1)!.matches[0] : null;
  const champion = final?.winnerSide ? (final.winnerSide === "A" ? final.teamA : final.teamB) : null;

  return {
    id: tournament.id,
    slug,
    name: tournament.name,
    description: tournament.description,
    location: tournament.location,
    startDate: tournament.startDate,
    endDate: tournament.endDate,
    status: tournament.status,
    eventType: tournament.eventType,
    skillLevel: tournament.skillLevel,
    courtCount: tournament.courtCount,
    registrationOpen: tournament.status === "REGISTRATION_OPEN" && tournament.registrationMode === "OPEN" && (!tournament.registrationDeadline || tournament.registrationDeadline > new Date()),
    registrationDeadline: tournament.registrationDeadline,
    entrantCount: tournament._count.entrants,
    teamCount: tournament._count.teams,
    presentedBy: tournament.presentedBy ?? tournament.createdBy.name,
    brandColor: tournament.brandColor,
    logoUrl: assetUrl(tournament.logoAssetId),
    logoAssetId: tournament.logoAssetId,
    bannerUrl: assetUrl(tournament.bannerAssetId),
    sponsors: tournament.sponsors.map((sponsor) => ({ id: sponsor.id, name: sponsor.name, url: sponsor.url, logoUrl: assetUrl(sponsor.logoAssetId) })),
    pools,
    rounds,
    champion,
  };
});

export type PublicTournament = NonNullable<Awaited<ReturnType<typeof loadPublicTournament>>>;
