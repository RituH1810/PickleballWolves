import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, context: { params: Promise<{ divisionId: string; userId: string }> }) {
  const { divisionId, userId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage registrations." }, { status: 401 });
  const division = await prisma.division.findUnique({ where: { id: divisionId }, include: { season: { include: { league: { select: { createdById: true } } } } } });
  if (!division) return NextResponse.json({ error: "Division not found." }, { status: 404 });
  if (division.season.league.createdById !== user.id) return NextResponse.json({ error: "Only the organizer can remove registrations." }, { status: 403 });

  await prisma.leagueRegistration.deleteMany({ where: { divisionId, userId } });
  await prisma.leagueTeamMember.deleteMany({ where: { userId, team: { divisionId } } });
  return NextResponse.json({ success: true });
}
