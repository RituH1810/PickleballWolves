import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generatePoolRounds } from "@/lib/tournament";

export async function POST(_request: Request, context: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to generate the schedule." }, { status: 401 });
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  if (tournament.createdById !== user.id) return NextResponse.json({ error: "Only the organizer can generate the schedule." }, { status: 403 });

  const hasScores = await prisma.gameScore.count({ where: { match: { tournamentGroup: { tournamentId } } } }) > 0;
  if (hasScores) return NextResponse.json({ error: "Scores have already been entered; the schedule can no longer be regenerated." }, { status: 400 });

  const pools = await prisma.tournamentGroup.findMany({
    where: { tournamentId },
    include: { teams: { include: { members: true } } },
    orderBy: { name: "asc" },
  });
  if (pools.length === 0) return NextResponse.json({ error: "Assign teams to groups before generating the schedule." }, { status: 400 });
  const emptyPools = pools.filter((pool) => pool.teams.length < 2);
  if (emptyPools.length > 0) return NextResponse.json({ error: `${emptyPools.map((pool) => pool.name).join(", ")} need at least 2 teams before the schedule can be generated.` }, { status: 400 });

  let courtCursor = 0;
  const nextCourt = () => { courtCursor = (courtCursor % tournament.courtCount) + 1; return courtCursor; };
  let totalMatches = 0;

  await prisma.$transaction(async (transaction) => {
    // Clear any previously generated (unscored) schedule so this can be safely re-run.
    const stalePoolMatches = await transaction.match.findMany({ where: { tournamentGroup: { tournamentId } }, select: { id: true } });
    const staleIds = stalePoolMatches.map((match) => match.id);
    await transaction.matchPlayer.deleteMany({ where: { matchId: { in: staleIds } } });
    await transaction.match.deleteMany({ where: { id: { in: staleIds } } });

    for (const pool of pools) {
      const teamsById = new Map(pool.teams.map((team) => [team.id, team]));
      const rounds = generatePoolRounds(pool.teams.map((team) => team.id));
      for (const round of rounds) {
        for (const [teamAId, teamBId] of round.matchups) {
          const teamA = teamsById.get(teamAId)!;
          const teamB = teamsById.get(teamBId)!;
          await transaction.match.create({
            data: {
              tournamentGroupId: pool.id,
              tournamentTeamAId: teamA.id,
              tournamentTeamBId: teamB.id,
              courtNumber: nextCourt(),
              scheduledAt: tournament.startDate,
              players: { create: [...teamA.members.map((member) => ({ userId: member.userId, side: "A" as const })), ...teamB.members.map((member) => ({ userId: member.userId, side: "B" as const }))] },
            },
          });
          totalMatches += 1;
        }
      }
    }
    await transaction.tournament.update({ where: { id: tournamentId }, data: { status: "LIVE" } });
  });

  return NextResponse.json({ pools: pools.length, matches: totalMatches });
}
