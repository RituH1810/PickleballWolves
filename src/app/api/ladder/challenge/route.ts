import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to send a challenge." }, { status: 401 });
  const profile = await ensureProfile(user);
  const body = await request.json();
  const ladder = await prisma.ladder.findUnique({ where: { id: body.ladderId } });
  if (!ladder) return NextResponse.json({ error: "Ladder not found." }, { status: 404 });
  const deadlineAt = new Date(Date.now() + ladder.responseDeadlineHours * 60 * 60 * 1000);
  const challenge = await prisma.challenge.create({ data: { ladderId: ladder.id, challengerId: profile.id, challengedId: body.challengedId, deadlineAt, status: "PENDING" } });
  return NextResponse.json({ challenge }, { status: 201 });
}
