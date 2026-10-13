import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";

export async function POST(request: Request, context: { params: Promise<{ divisionId: string }> }) {
  const { divisionId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to register for this division." }, { status: 401 });
  const profile = await ensureProfile(user);
  const division = await prisma.division.findUnique({ where: { id: divisionId }, include: { season: true } });
  if (!division) return NextResponse.json({ error: "Division not found." }, { status: 404 });
  const now = new Date();
  if (now < division.season.registrationOpensAt || now > division.season.registrationClosesAt) return NextResponse.json({ error: "Registration isn't open right now." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const rating = Number(profile.skillRating);
  const minOk = division.minSkillRating == null || rating >= Number(division.minSkillRating);
  const maxOk = division.maxSkillRating == null || rating <= Number(division.maxSkillRating);
  if ((!minOk || !maxOk) && !body.override) {
    const band = `${division.minSkillRating ?? "any"}–${division.maxSkillRating ?? "any"}`;
    return NextResponse.json({ error: `Your skill rating doesn't match this division's ${band} band.`, skillMismatch: true }, { status: 400 });
  }

  const registration = await prisma.leagueRegistration.upsert({
    where: { divisionId_userId: { divisionId, userId: profile.id } },
    update: { status: "REGISTERED" },
    create: { divisionId, userId: profile.id, status: "REGISTERED" },
  });
  return NextResponse.json({ status: registration.status });
}

export async function DELETE(_request: Request, context: { params: Promise<{ divisionId: string }> }) {
  const { divisionId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to withdraw." }, { status: 401 });
  await prisma.leagueRegistration.deleteMany({ where: { divisionId, userId: user.id } });
  return NextResponse.json({ success: true });
}
