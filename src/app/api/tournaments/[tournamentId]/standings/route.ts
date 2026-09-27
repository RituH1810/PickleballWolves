import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await context.params;
  const pools = await prisma.tournamentGroup.findMany({
    where: { tournamentId },
    orderBy: { name: "asc" },
    include: {
      teams: { include: { members: { include: { user: { select: { name: true } } } } } },
      matches: { where: { deletedAt: null }, include: { scores: true } },
    },
  });

  const standingsByPool = pools.map((pool) => {
    const stats = new Map(pool.teams.map((team) => [team.id, {
      teamId: team.id,
      teamName: team.members.map((member) => member.user.name).join(" / ") || "TBD",
      wins: 0,
      losses: 0,
      scored: 0,
      conceded: 0,
    }]));
    for (const match of pool.matches) {
      if (!match.tournamentTeamAId || !match.tournamentTeamBId) continue;
      const teamA = stats.get(match.tournamentTeamAId);
      const teamB = stats.get(match.tournamentTeamBId);
      if (!teamA || !teamB) continue;
      for (const score of match.scores) {
        teamA.scored += score.sideAScore;
        teamA.conceded += score.sideBScore;
        teamB.scored += score.sideBScore;
        teamB.conceded += score.sideAScore;
        if (score.sideAScore > score.sideBScore) { teamA.wins += 1; teamB.losses += 1; } else { teamB.wins += 1; teamA.losses += 1; }
      }
    }
    const standings = [...stats.values()]
      .sort((a, b) => b.wins - a.wins || (b.scored - b.conceded) - (a.scored - a.conceded))
      .map((entry, index) => ({ rank: index + 1, ...entry, differential: entry.scored - entry.conceded }));
    return { poolId: pool.id, poolName: pool.name, standings };
  });

  return NextResponse.json({ pools: standingsByPool });
}
