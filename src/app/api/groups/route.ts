import { NextResponse } from "next/server";
import { GroupVisibility, MembershipRole, MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const groups = await prisma.group.findMany({
    where: { visibility: GroupVisibility.PUBLIC },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { memberships: { where: { status: MembershipStatus.ACTIVE } } } },
      events: { where: { status: "PUBLISHED", startsAt: { gte: now } }, orderBy: { startsAt: "asc" }, take: 1, select: { title: true, startsAt: true } },
      // "Next up" can come from either an event or a round robin -- whichever is soonest.
      roundRobins: { where: { status: { in: ["SETUP", "LIVE"] }, OR: [{ scheduledAt: null }, { scheduledAt: { gte: startOfToday } }] }, orderBy: { scheduledAt: "asc" }, take: 1, select: { name: true, scheduledAt: true } },
      memberships: user ? { where: { userId: user.id, status: MembershipStatus.ACTIVE }, select: { id: true } } : false,
    },
  });
  return NextResponse.json({ groups: groups.map((group) => {
    const nextEvent = group.events[0];
    const nextRoundRobin = group.roundRobins[0];
    let next = "No upcoming games";
    if (nextEvent && nextRoundRobin) next = (nextRoundRobin.scheduledAt && nextEvent.startsAt <= nextRoundRobin.scheduledAt) ? nextEvent.title : nextRoundRobin.name;
    else if (nextEvent) next = nextEvent.title;
    else if (nextRoundRobin) next = nextRoundRobin.name;
    return { id: group.id, name: group.name, location: group.location, members: group._count.memberships, next, mark: group.name.split(" ").map((word) => word[0]).join("").slice(0, 2), isMember: user ? group.memberships.length > 0 : false };
  }) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a group." }, { status: 401 });
  const profile = await ensureProfile(user);
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  if (!name || !location) return NextResponse.json({ error: "Enter a group name and location." }, { status: 400 });
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now().toString(36)}`;
  const group = await prisma.group.create({ data: { name, slug, location, description: body.description?.trim() ?? "", visibility: body.visibility === "PRIVATE" ? GroupVisibility.PRIVATE : GroupVisibility.PUBLIC, createdById: profile.id, memberships: { create: { userId: profile.id, role: MembershipRole.ORGANIZER, status: MembershipStatus.ACTIVE, joinedAt: new Date() } } } });
  return NextResponse.json({ group }, { status: 201 });
}
