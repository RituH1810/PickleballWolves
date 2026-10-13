import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeLeagueStandings } from "@/lib/league";

export async function GET(_request: Request, context: { params: Promise<{ seasonId: string }> }) {
  const { seasonId } = await context.params;
  const divisions = await prisma.division.findMany({
    where: { seasonId },
    orderBy: { name: "asc" },
    include: {
      teams: { include: { members: { include: { user: { select: { name: true } } } } } },
      matches: { where: { deletedAt: null }, include: { scores: true } },
    },
  });

  const standingsByDivision = divisions.map((division) => {
    const nameByTeamId = new Map(division.teams.map((team) => [team.id, team.members.map((member) => member.user.name).join(" / ") || "TBD"]));
    const matches = division.matches.map((match) => ({ teamAId: match.leagueTeamAId, teamBId: match.leagueTeamBId, scores: match.scores }));
    const standings = computeLeagueStandings(division.teams.map((team) => team.id), matches).map((entry) => ({ ...entry, teamName: nameByTeamId.get(entry.teamId) ?? "TBD" }));
    return { divisionId: division.id, divisionName: division.name, standings };
  });

  return NextResponse.json({ divisions: standingsByDivision });
}
