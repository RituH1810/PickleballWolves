import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
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
  const organizerIds = [...new Set(roundRobins.map((roundRobin) => roundRobin.createdById))];
  const organizers = await prisma.user.findMany({ where: { id: { in: organizerIds } }, select: { id: true, name: true } });
  const organizerNameById = new Map(organizers.map((organizer) => [organizer.id, organizer.name]));
  return NextResponse.json({
    roundRobins: roundRobins.map((roundRobin) => ({
      id: roundRobin.id,
      name: roundRobin.name,
      format: roundRobin.format,
      partnerFormat: roundRobin.partnerFormat,
      playFormat: roundRobin.playFormat,
      status: roundRobin.status,
      matchCount: roundRobin._count.matches,
      scheduledAt: roundRobin.scheduledAt,
      createdAt: roundRobin.createdAt,
      isOwner: roundRobin.createdById === user.id,
      organizerName: organizerNameById.get(roundRobin.createdById) ?? "Unknown",
    })),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a round robin." }, { status: 401 });
  const profile = await ensureProfile(user);
  const body = await request.json();

  const groupId = typeof body.groupId === "string" && body.groupId ? body.groupId : null;
  let group: { name: string } | null = null;
  if (groupId) {
    const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: profile.id } } });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) return NextResponse.json({ error: "Join this group before creating a round robin for it." }, { status: 403 });
    group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true } });
  }

  const scheduledAt = typeof body.scheduledAt === "string" && body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) return NextResponse.json({ error: "Enter a valid date and time." }, { status: 400 });
  if (groupId && !scheduledAt) return NextResponse.json({ error: "Pick a date and time so the group knows when to show up." }, { status: 400 });

  const partnerFormat = ["ROTATE", "FIXED"].includes(body.partnerFormat) ? body.partnerFormat : "ROTATE";
  const playFormat = ["SINGLES", "DOUBLES", "MIXED"].includes(body.playFormat) ? body.playFormat : "DOUBLES";
  // Group round robins are named after the group and the day they were created, rather than a
  // freeform title, so the group's list stays consistent regardless of who organizes each one.
  const name = group ? `${group.name} - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : (body.name?.trim() || "New round robin");
  const roundRobin = await prisma.roundRobin.create({ data: { name, createdById: profile.id, groupId, scheduledAt, format: body.format || "POPCORN", partnerFormat, playFormat, courtCount: Number(body.courtCount) || 2, roundCount: Number(body.roundCount) || 4, pointsToWin: [11, 15, 21].includes(Number(body.pointsToWin)) ? Number(body.pointsToWin) : 11, winBy: Number(body.winBy) === 2 ? 2 : 1, skillBalanced: Boolean(body.skillBalanced) } });
  return NextResponse.json({ roundRobin }, { status: 201 });
}
