import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ seasonId: string }> }) {
  const { seasonId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      league: { include: { createdBy: { select: { id: true, name: true } } } },
      divisions: {
        orderBy: { name: "asc" },
        include: {
          registrations: { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true, skillRating: true } } } },
          teams: { include: { members: { include: { user: { select: { id: true, name: true } } } } } },
          leagueMatches: {
            orderBy: [{ weekNumber: "asc" }],
            include: { match: { include: { players: { include: { user: { select: { id: true, name: true } } } }, scores: true } } },
          },
        },
      },
    },
  });
  if (!season) return NextResponse.json({ error: "Season not found." }, { status: 404 });

  const hasScores = await prisma.gameScore.count({ where: { match: { leagueMatch: { seasonId } } } }) > 0;

  return NextResponse.json({
    season: {
      id: season.id,
      name: season.name,
      startDate: season.startDate,
      endDate: season.endDate,
      registrationOpensAt: season.registrationOpensAt,
      registrationClosesAt: season.registrationClosesAt,
      status: season.status,
      playoffsEnabled: season.playoffsEnabled,
      league: { id: season.league.id, name: season.league.name, format: season.league.format, description: season.league.description, createdBy: season.league.createdBy },
      isOwner: user ? season.league.createdById === user.id : false,
      hasScores,
      divisions: season.divisions.map((division) => ({
        id: division.id,
        name: division.name,
        minSkillRating: division.minSkillRating?.toString() ?? null,
        maxSkillRating: division.maxSkillRating?.toString() ?? null,
        registrations: division.registrations.map((registration) => ({ id: registration.user.id, name: registration.user.name, skillRating: registration.user.skillRating.toString(), status: registration.status })),
        teams: division.teams.map((team) => ({ id: team.id, members: team.members.map((member) => ({ id: member.user.id, name: member.user.name })) })),
        weeks: division.leagueMatches.map((leagueMatch) => ({
          weekNumber: leagueMatch.weekNumber,
          scheduledAt: leagueMatch.scheduledAt,
          matchId: leagueMatch.match.id,
          courtNumber: leagueMatch.match.courtNumber,
          leagueTeamAId: leagueMatch.match.leagueTeamAId,
          leagueTeamBId: leagueMatch.match.leagueTeamBId,
          players: leagueMatch.match.players.map((player) => ({ userId: player.user.id, name: player.user.name, side: player.side })),
          scores: leagueMatch.match.scores.map((score) => ({ gameNumber: score.gameNumber, sideAScore: score.sideAScore, sideBScore: score.sideBScore })),
        })),
      })),
    },
  });
}
