import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to join the ladder." }, { status: 401 });
  const profile = await ensureProfile(user);
  const ladder = await prisma.ladder.findFirst({ where: { active: true } });
  if (!ladder) return NextResponse.json({ error: "No active ladder to join." }, { status: 404 });
  const existing = await prisma.ladderPosition.findUnique({ where: { ladderId_userId: { ladderId: ladder.id, userId: profile.id } } });
  if (existing) return NextResponse.json({ error: "You're already on this ladder." }, { status: 400 });
  const bottom = await prisma.ladderPosition.findFirst({ where: { ladderId: ladder.id }, orderBy: { position: "desc" } });
  const position = await prisma.ladderPosition.create({ data: { ladderId: ladder.id, userId: profile.id, position: (bottom?.position ?? 0) + 1, rating: Number(profile.skillRating) } });
  return NextResponse.json({ position }, { status: 201 });
}
