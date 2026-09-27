import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { buildBracket, computeTeamStandings, seedQualifiers } from "@/lib/tournament";

export async function POST(request: Request, context: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to generate the bracket." }, { status: 401 });
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  if (tournament.createdById !== user.id) return NextResponse.json({ error: "Only the organizer can generate the bracket." }, { status: 403 });

  const existingBracketScores = await prisma.gameScore.count({ where: { match: { bracketMatch: { tournamentId } } } });
  if (existingBracketScores > 0) return NextResponse.json({ error: "Bracket scores have already been entered; it can no longer be regenerated." }, { status: 400 });

  const pools = await prisma.tournamentGroup.findMany({
    where: { tournamentId },
    orderBy: { name: "asc" },
    include: { teams: true, matches: { where: { deletedAt: null }, include: { scores: true } } },
  });
  if (pools.length === 0) return NextResponse.json({ error: "Generate group play before building a bracket." }, { status: 400 });
  const unfinishedPool = pools.find((pool) => pool.matches.length === 0 || pool.matches.some((match) => match.scores.length === 0));
  if (unfinishedPool) return NextResponse.json({ error: `${unfinishedPool.name} still has unscored matches; finish group play before generating the bracket.` }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const advancePerPool = Number.isInteger(Number(body.advancePerPool)) && Number(body.advancePerPool) > 0 ? Number(body.advancePerPool) : 1;

  const qualifierInputs: { teamId: string; poolRank: number; wins: number; differential: number }[] = [];
  for (const pool of pools) {
    const standings = computeTeamStandings(pool.teams.map((team) => team.id), pool.matches);
    for (const entry of standings.filter((standing) => standing.rank <= advancePerPool)) {
      qualifierInputs.push({ teamId: entry.teamId, poolRank: entry.rank, wins: entry.wins, differential: entry.differential });
    }
  }
  if (qualifierInputs.length < 2) return NextResponse.json({ error: "Need at least 2 qualifying teams to build a bracket." }, { status: 400 });

  const seeded = seedQualifiers(qualifierInputs);
  const plans = buildBracket(seeded);

  await prisma.$transaction(async (transaction) => {
    // Clear any previous (unscored) bracket before rebuilding.
    const staleBracketMatches = await transaction.tournamentBracketMatch.findMany({ where: { tournamentId }, select: { id: true, matchId: true } });
    const staleMatchIds = staleBracketMatches.map((bracketMatch) => bracketMatch.matchId).filter((id): id is string => Boolean(id));
    await transaction.tournamentBracketMatch.updateMany({ where: { tournamentId }, data: { nextMatchId: null } });
    await transaction.tournamentBracketMatch.deleteMany({ where: { tournamentId } });
    await transaction.matchPlayer.deleteMany({ where: { matchId: { in: staleMatchIds } } });
    await transaction.match.deleteMany({ where: { id: { in: staleMatchIds } } });

    const rowIdByRoundPosition = new Map<string, string>();
    for (const plan of plans) {
      let matchId: string | null = null;
      if (plan.teamAId && plan.teamBId) {
        const [teamA, teamB] = await Promise.all([
          transaction.tournamentTeam.findUnique({ where: { id: plan.teamAId }, include: { members: true } }),
          transaction.tournamentTeam.findUnique({ where: { id: plan.teamBId }, include: { members: true } }),
        ]);
        const match = await transaction.match.create({
          data: {
            courtNumber: 1,
            scheduledAt: tournament.startDate,
            tournamentTeamAId: plan.teamAId,
            tournamentTeamBId: plan.teamBId,
            players: { create: [...teamA!.members.map((member) => ({ userId: member.userId, side: "A" as const })), ...teamB!.members.map((member) => ({ userId: member.userId, side: "B" as const }))] },
          },
        });
        matchId = match.id;
      }
      const bracketMatch = await transaction.tournamentBracketMatch.create({
        data: { tournamentId, round: plan.round, position: plan.position, teamAId: plan.teamAId, teamBId: plan.teamBId, matchId },
      });
      rowIdByRoundPosition.set(`${plan.round}:${plan.position}`, bracketMatch.id);
    }
    for (const plan of plans) {
      if (plan.nextRound === null || plan.nextPosition === null) continue;
      const thisRowId = rowIdByRoundPosition.get(`${plan.round}:${plan.position}`)!;
      const nextRowId = rowIdByRoundPosition.get(`${plan.nextRound}:${plan.nextPosition}`)!;
      await transaction.tournamentBracketMatch.update({ where: { id: thisRowId }, data: { nextMatchId: nextRowId, nextSlot: plan.nextSlot } });
    }
  });

  return NextResponse.json({ bracketMatches: plans.length, totalRounds: Math.max(...plans.map((plan) => plan.round)) });
}
