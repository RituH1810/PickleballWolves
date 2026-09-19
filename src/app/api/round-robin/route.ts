import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a round robin." }, { status: 401 });
  const profile = await ensureProfile(user);
  const body = await request.json();
  const roundRobin = await prisma.roundRobin.create({ data: { name: body.name?.trim() || "New round robin", createdById: profile.id, format: body.format || "ROTATING_PARTNERS", courtCount: Number(body.courtCount) || 2, roundCount: Number(body.roundCount) || 4, pointsToWin: [11, 15, 21].includes(Number(body.pointsToWin)) ? Number(body.pointsToWin) : 11, winBy: Number(body.winBy) === 2 ? 2 : 1, skillBalanced: Boolean(body.skillBalanced) } });
  return NextResponse.json({ roundRobin }, { status: 201 });
}
