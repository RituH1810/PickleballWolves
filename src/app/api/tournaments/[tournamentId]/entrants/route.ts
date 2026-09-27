import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { skillLevelForRating } from "@/lib/tournament";

export async function POST(request: Request, context: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage entrants." }, { status: 401 });
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  if (tournament.createdById !== user.id) return NextResponse.json({ error: "Only the organizer can add entrants." }, { status: 403 });

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  const target = userId ? await prisma.user.findUnique({ where: { id: userId } }) : email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (!target) return NextResponse.json({ error: "No player found with that email." }, { status: 404 });

  const matchesLevel = skillLevelForRating(Number(target.skillRating)) === tournament.skillLevel;
  if (!matchesLevel && !body.override) {
    return NextResponse.json({ error: `${target.name}'s skill rating doesn't match this tournament's ${tournament.skillLevel.toLowerCase()} level.`, skillMismatch: true }, { status: 400 });
  }

  const entrant = await prisma.tournamentEntrant.upsert({
    where: { tournamentId_userId: { tournamentId, userId: target.id } },
    update: { status: "REGISTERED" },
    create: { tournamentId, userId: target.id, status: "REGISTERED" },
  });
  return NextResponse.json({ entrant: { id: target.id, name: target.name, status: entrant.status } }, { status: 201 });
}
