import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ divisionId: string }> }) {
  const { divisionId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage registrations." }, { status: 401 });
  const division = await prisma.division.findUnique({ where: { id: divisionId }, include: { season: { include: { league: { select: { createdById: true } } } } } });
  if (!division) return NextResponse.json({ error: "Division not found." }, { status: 404 });
  if (division.season.league.createdById !== user.id) return NextResponse.json({ error: "Only the organizer can add registrations." }, { status: 403 });

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  const target = userId ? await prisma.user.findUnique({ where: { id: userId } }) : email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (!target) return NextResponse.json({ error: "No player found with that email." }, { status: 404 });

  const rating = Number(target.skillRating);
  const minOk = division.minSkillRating == null || rating >= Number(division.minSkillRating);
  const maxOk = division.maxSkillRating == null || rating <= Number(division.maxSkillRating);
  if ((!minOk || !maxOk) && !body.override) {
    const band = `${division.minSkillRating ?? "any"}–${division.maxSkillRating ?? "any"}`;
    return NextResponse.json({ error: `${target.name}'s skill rating doesn't match this division's ${band} band.`, skillMismatch: true }, { status: 400 });
  }

  const registration = await prisma.leagueRegistration.upsert({
    where: { divisionId_userId: { divisionId, userId: target.id } },
    update: { status: "REGISTERED" },
    create: { divisionId, userId: target.id, status: "REGISTERED" },
  });
  return NextResponse.json({ registration: { id: target.id, name: target.name, status: registration.status } }, { status: 201 });
}
