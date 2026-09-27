import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";
import { skillLevelForRating } from "@/lib/tournament";

export async function POST(request: Request, context: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to register for this tournament." }, { status: 401 });
  const profile = await ensureProfile(user);
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  if (tournament.registrationMode !== "OPEN") return NextResponse.json({ error: "This tournament isn't open for self-registration; ask the organizer to add you." }, { status: 400 });
  if (tournament.status !== "REGISTRATION_OPEN") return NextResponse.json({ error: "Registration isn't open right now." }, { status: 400 });
  if (tournament.registrationDeadline && tournament.registrationDeadline < new Date()) return NextResponse.json({ error: "The registration deadline has passed." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const matchesLevel = skillLevelForRating(Number(profile.skillRating)) === tournament.skillLevel;
  if (!matchesLevel && !body.override) {
    return NextResponse.json({ error: `Your skill rating doesn't match this tournament's ${tournament.skillLevel.toLowerCase()} level.`, skillMismatch: true }, { status: 400 });
  }

  const entrant = await prisma.tournamentEntrant.upsert({
    where: { tournamentId_userId: { tournamentId, userId: profile.id } },
    update: { status: "REGISTERED" },
    create: { tournamentId, userId: profile.id, status: "REGISTERED" },
  });
  return NextResponse.json({ status: entrant.status });
}

export async function DELETE(_request: Request, context: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to withdraw." }, { status: 401 });
  await prisma.tournamentEntrant.deleteMany({ where: { tournamentId, userId: user.id } });
  return NextResponse.json({ success: true });
}
