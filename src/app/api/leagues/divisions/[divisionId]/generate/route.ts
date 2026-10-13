import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generatePoolRounds } from "@/lib/tournament";

export async function POST(request: Request, context: { params: Promise<{ divisionId: string }> }) {
  const { divisionId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to generate the schedule." }, { status: 401 });
  const division = await prisma.division.findUnique({ where: { id: divisionId }, include: { season: { include: { league: { select: { createdById: true } } } } } });
  if (!division) return NextResponse.json({ error: "Division not found." }, { status: 404 });
  if (division.season.league.createdById !== user.id) return NextResponse.json({ error: "Only the organizer can generate the schedule." }, { status: 403 });

  const hasScores = await prisma.gameScore.count({ where: { match: { leagueDivisionId: divisionId } } }) > 0;
  if (hasScores) return NextResponse.json({ error: "Scores have already been entered; the schedule can no longer be regenerated." }, { status: 400 });

  const teams = await prisma.leagueTeam.findMany({ where: { divisionId }, include: { members: true } });
  if (teams.length < 2) return NextResponse.json({ error: "Form at least 2 teams before generating the schedule." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const matchesPerPairing = Number.isInteger(Number(body.matchesPerPairing)) && Number(body.matchesPerPairing) >= 1 && Number(body.matchesPerPairing) <= 5 ? Number(body.matchesPerPairing) : 1;

  // generatePoolRounds is tournament.ts's pool scheduler, but it's fully generic (plain team id
  // strings in, round-numbered matchups out) so it's reused as-is -- each roundNumber becomes a
  // week number here instead of a tournament pool round.
  const rounds = generatePoolRounds(teams.map((team) => team.id), matchesPerPairing);
  const teamsById = new Map(teams.map((team) => [team.id, team]));

  let totalMatches = 0;
  await prisma.$transaction(async (transaction) => {
    // Clear any previously generated (unscored) schedule so this can be safely re-run.
    const staleMatches = await transaction.match.findMany({ where: { leagueDivisionId: divisionId }, select: { id: true } });
    const staleIds = staleMatches.map((match) => match.id);
    await transaction.leagueMatch.deleteMany({ where: { matchId: { in: staleIds } } });
    await transaction.matchPlayer.deleteMany({ where: { matchId: { in: staleIds } } });
    await transaction.match.deleteMany({ where: { id: { in: staleIds } } });

    for (const round of rounds) {
      const weekNumber = round.roundNumber;
      const scheduledAt = new Date(division.season.startDate.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
      for (const [teamAId, teamBId] of round.matchups) {
        const teamA = teamsById.get(teamAId)!;
        const teamB = teamsById.get(teamBId)!;
        const match = await transaction.match.create({
          data: {
            leagueDivisionId: divisionId,
            leagueTeamAId: teamA.id,
            leagueTeamBId: teamB.id,
            scheduledAt,
            players: { create: [...teamA.members.map((member) => ({ userId: member.userId, side: "A" as const })), ...teamB.members.map((member) => ({ userId: member.userId, side: "B" as const }))] },
          },
        });
        await transaction.leagueMatch.create({ data: { seasonId: division.seasonId, divisionId, matchId: match.id, weekNumber, scheduledAt, status: "SCHEDULED" } });
        totalMatches += 1;
      }
    }
    await transaction.season.update({ where: { id: division.seasonId }, data: { status: "ACTIVE" } });
  });

  return NextResponse.json({ matches: totalMatches, weeks: rounds.length });
}
