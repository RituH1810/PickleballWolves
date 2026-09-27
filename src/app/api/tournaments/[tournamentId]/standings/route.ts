import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeTeamStandings } from "@/lib/tournament";

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
    const nameByTeamId = new Map(pool.teams.map((team) => [team.id, team.members.map((member) => member.user.name).join(" / ") || "TBD"]));
    const standings = computeTeamStandings(pool.teams.map((team) => team.id), pool.matches).map((entry) => ({ ...entry, teamName: nameByTeamId.get(entry.teamId) ?? "TBD" }));
    return { poolId: pool.id, poolName: pool.name, standings };
  });

  return NextResponse.json({ pools: standingsByPool });
}
