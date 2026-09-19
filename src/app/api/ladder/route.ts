import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";

export async function GET() {
  const ladder = await prisma.ladder.findFirst({ where: { active: true } });
  if (!ladder) return NextResponse.json({ ladder: null, positions: [] });
  const positions = await prisma.ladderPosition.findMany({ where: { ladderId: ladder.id }, orderBy: { position: "asc" } });
  const users = await prisma.user.findMany({ where: { id: { in: positions.map((position) => position.userId) } }, select: { id: true, name: true, skillRating: true } });
  return NextResponse.json({ ladder, positions: positions.map((position) => ({ ...position, rating: position.rating.toString(), name: users.find((user) => user.id === position.userId)?.name ?? "Player" })) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a ladder." }, { status: 401 });
  const profile = await ensureProfile(user);
  const body = await request.json();
  const ladder = await prisma.ladder.create({ data: { name: body.name?.trim() || "Wolves Challenge Ladder", type: body.type || "CHALLENGE", challengeRange: Number(body.challengeRange) || 3, responseDeadlineHours: Number(body.responseDeadlineHours) || 48, createdById: profile.id } });
  await prisma.ladderPosition.create({ data: { ladderId: ladder.id, userId: profile.id, position: 1, rating: Number(profile.skillRating) } });
  return NextResponse.json({ ladder }, { status: 201 });
}
