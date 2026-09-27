import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, context: { params: Promise<{ tournamentId: string; userId: string }> }) {
  const { tournamentId, userId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage entrants." }, { status: 401 });
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  if (tournament.createdById !== user.id) return NextResponse.json({ error: "Only the organizer can remove entrants." }, { status: 403 });

  await prisma.tournamentEntrant.deleteMany({ where: { tournamentId, userId } });
  await prisma.tournamentTeamMember.deleteMany({ where: { userId, team: { tournamentId } } });
  return NextResponse.json({ success: true });
}
