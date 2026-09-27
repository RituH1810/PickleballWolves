import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { skillLevelForRating } from "@/lib/tournament";

export async function GET(_request: Request, context: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      createdBy: { select: { id: true, name: true } },
      entrants: { include: { user: { select: { id: true, name: true, skillRating: true, gender: true } } } },
      teams: { include: { members: { include: { user: { select: { id: true, name: true } } } } }, orderBy: { seed: "asc" } },
      pools: {
        include: {
          teams: { include: { members: { include: { user: { select: { id: true, name: true } } } } } },
          matches: { where: { deletedAt: null }, orderBy: { courtNumber: "asc" }, include: { players: { include: { user: { select: { id: true, name: true } } } }, scores: true } },
        },
        orderBy: { name: "asc" },
      },
      bracketMatches: {
        orderBy: [{ round: "asc" }, { position: "asc" }],
        include: {
          teamA: { include: { members: { include: { user: { select: { id: true, name: true } } } } } },
          teamB: { include: { members: { include: { user: { select: { id: true, name: true } } } } } },
          match: { include: { players: { include: { user: { select: { id: true, name: true } } } }, scores: true } },
        },
      },
    },
  });
  if (!tournament) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const hasScores = await prisma.gameScore.count({ where: { match: { OR: [{ tournamentGroup: { tournamentId } }, { bracketMatch: { tournamentId } }] } } }) > 0;
  const myEntrant = user ? tournament.entrants.find((entrant) => entrant.userId === user.id) : undefined;

  return NextResponse.json({
    tournament: {
      ...tournament,
      isOwner: user ? tournament.createdById === user.id : false,
      hasScores,
      myEntrantStatus: myEntrant?.status ?? null,
      entrants: tournament.entrants.map((entrant) => ({
        id: entrant.userId,
        name: entrant.user.name,
        skillRating: entrant.user.skillRating.toString(),
        gender: entrant.user.gender,
        status: entrant.status,
        matchesSkillLevel: skillLevelForRating(Number(entrant.user.skillRating)) === tournament.skillLevel,
      })),
    },
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to edit this tournament." }, { status: 401 });
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  if (tournament.createdById !== user.id) return NextResponse.json({ error: "Only the organizer can edit this tournament." }, { status: 403 });
  const hasScores = await prisma.gameScore.count({ where: { match: { OR: [{ tournamentGroup: { tournamentId } }, { bracketMatch: { tournamentId } }] } } }) > 0;
  if (hasScores) return NextResponse.json({ error: "Scores have already been entered; this tournament can no longer be edited." }, { status: 400 });

  const body = await request.json();
  const updated = await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : tournament.name,
      description: typeof body.description === "string" ? body.description.trim() || null : tournament.description,
      location: typeof body.location === "string" && body.location.trim() ? body.location.trim() : tournament.location,
      courtCount: Number.isInteger(Number(body.courtCount)) && Number(body.courtCount) > 0 ? Number(body.courtCount) : tournament.courtCount,
      startDate: typeof body.startDate === "string" && !Number.isNaN(new Date(body.startDate).getTime()) ? new Date(body.startDate) : tournament.startDate,
      pointsToWin: [11, 15, 21].includes(Number(body.pointsToWin)) ? Number(body.pointsToWin) : tournament.pointsToWin,
      winBy: Number(body.winBy) === 2 ? 2 : tournament.winBy,
      maxTeamsPerGroup: Number.isInteger(Number(body.maxTeamsPerGroup)) && Number(body.maxTeamsPerGroup) > 0 ? Number(body.maxTeamsPerGroup) : tournament.maxTeamsPerGroup,
    },
  });
  return NextResponse.json({ tournament: updated });
}

export async function DELETE(_request: Request, context: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete this tournament." }, { status: 401 });
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  if (tournament.createdById !== user.id) return NextResponse.json({ error: "Only the organizer can delete this tournament." }, { status: 403 });
  const hasScores = await prisma.gameScore.count({ where: { match: { OR: [{ tournamentGroup: { tournamentId } }, { bracketMatch: { tournamentId } }] } } }) > 0;
  if (hasScores) return NextResponse.json({ error: "Scores have already been entered; this tournament can no longer be deleted." }, { status: 400 });

  const matches = await prisma.match.findMany({ where: { OR: [{ tournamentGroup: { tournamentId } }, { bracketMatch: { tournamentId } }] }, select: { id: true } });
  const matchIds = matches.map((match) => match.id);
  await prisma.$transaction([
    prisma.matchPlayer.deleteMany({ where: { matchId: { in: matchIds } } }),
    prisma.match.deleteMany({ where: { id: { in: matchIds } } }),
    prisma.tournament.delete({ where: { id: tournamentId } }), // cascades entrants, teams, team members, pools
  ]);
  return NextResponse.json({ success: true });
}
