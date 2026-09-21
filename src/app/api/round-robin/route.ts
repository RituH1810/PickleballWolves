import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ roundRobins: [] });
  const roundRobins = await prisma.roundRobin.findMany({
    where: { OR: [{ createdById: user.id }, { matches: { some: { players: { some: { userId: user.id } } } } }] },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { matches: true } } },
  });
  return NextResponse.json({
    roundRobins: roundRobins.map((roundRobin) => ({
      id: roundRobin.id,
      name: roundRobin.name,
      format: roundRobin.format,
      partnerFormat: roundRobin.partnerFormat,
      playFormat: roundRobin.playFormat,
      status: roundRobin.status,
      matchCount: roundRobin._count.matches,
      createdAt: roundRobin.createdAt,
      isOwner: roundRobin.createdById === user.id,
    })),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a round robin." }, { status: 401 });
  const profile = await ensureProfile(user);
  const body = await request.json();
  const partnerFormat = ["ROTATE", "FIXED"].includes(body.partnerFormat) ? body.partnerFormat : "ROTATE";
  const playFormat = ["SINGLES", "DOUBLES", "MIXED"].includes(body.playFormat) ? body.playFormat : "DOUBLES";
  const roundRobin = await prisma.roundRobin.create({ data: { name: body.name?.trim() || "New round robin", createdById: profile.id, format: body.format || "POPCORN", partnerFormat, playFormat, courtCount: Number(body.courtCount) || 2, roundCount: Number(body.roundCount) || 4, pointsToWin: [11, 15, 21].includes(Number(body.pointsToWin)) ? Number(body.pointsToWin) : 11, winBy: Number(body.winBy) === 2 ? 2 : 1, skillBalanced: Boolean(body.skillBalanced) } });
  return NextResponse.json({ roundRobin }, { status: 201 });
}
