import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { assignGroupsRandom, assignGroupsSeeded, distributeIntoGroups, groupCountFromTargetSize } from "@/lib/tournament";

export async function POST(request: Request, context: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to assign groups." }, { status: 401 });
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  if (tournament.createdById !== user.id) return NextResponse.json({ error: "Only the organizer can assign groups." }, { status: 403 });
  if (tournament.status === "LIVE" || tournament.status === "COMPLETED") return NextResponse.json({ error: "Groups are locked once the tournament has started." }, { status: 400 });

  const teams = await prisma.tournamentTeam.findMany({ where: { tournamentId }, orderBy: { createdAt: "asc" } });
  if (teams.length === 0) return NextResponse.json({ error: "Form teams before assigning groups." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  // groupCount is derived from the organizer's "max teams per group" preference and the real
  // team count, rather than a fixed number picked before teams even existed -- callers can still
  // override it explicitly (e.g. a manual assignment already implies its own count).
  const groupCount = Number.isInteger(Number(body.groupCount)) && Number(body.groupCount) > 0 ? Number(body.groupCount) : groupCountFromTargetSize(teams.length, tournament.maxTeamsPerGroup);
  const method: string = ["MANUAL", "RANDOM", "SEEDED"].includes(body.method) ? body.method : tournament.groupAssignmentMethod;
  const preview = Boolean(body.preview);

  let assignment: string[][];
  if (method === "MANUAL") {
    const rawGroups: unknown = body.groups;
    if (!Array.isArray(rawGroups) || !rawGroups.every((group) => Array.isArray(group) && group.every((id) => typeof id === "string"))) {
      return NextResponse.json({ error: "Provide the group assignments you've picked." }, { status: 400 });
    }
    const teamIds = new Set(teams.map((team) => team.id));
    const assigned = new Set<string>();
    for (const group of rawGroups as string[][]) {
      for (const teamId of group) {
        if (!teamIds.has(teamId)) return NextResponse.json({ error: "Every assigned team must belong to this tournament." }, { status: 400 });
        if (assigned.has(teamId)) return NextResponse.json({ error: "A team can only be in one group." }, { status: 400 });
        assigned.add(teamId);
      }
    }
    assignment = rawGroups as string[][];
  } else if (method === "SEEDED") {
    assignment = assignGroupsSeeded(teams.map((team, index) => ({ id: team.id, seed: team.seed ?? index + 1 })), groupCount);
  } else {
    assignment = assignGroupsRandom(teams.map((team) => team.id), groupCount);
  }

  const sizes = assignment.map((group) => group.length);
  if (preview) return NextResponse.json({ preview: true, groupCount: assignment.length, sizes, expectedSizes: distributeIntoGroups(teams.length, groupCount) });

  await prisma.$transaction(async (transaction) => {
    await transaction.tournamentTeam.updateMany({ where: { tournamentId }, data: { poolId: null } });
    await transaction.tournamentGroup.deleteMany({ where: { tournamentId } });
    for (let index = 0; index < assignment.length; index++) {
      const pool = await transaction.tournamentGroup.create({ data: { tournamentId, name: `Group ${String.fromCharCode(65 + index)}` } });
      if (assignment[index].length > 0) await transaction.tournamentTeam.updateMany({ where: { id: { in: assignment[index] } }, data: { poolId: pool.id } });
    }
    await transaction.tournament.update({ where: { id: tournamentId }, data: { groupCount: assignment.length } });
  });

  return NextResponse.json({ groupCount: assignment.length, sizes });
}
