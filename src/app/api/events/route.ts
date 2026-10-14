import { NextResponse } from "next/server";
import { EventFormat, EventStatus, MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";
import { notify } from "@/lib/notifications";

export async function GET() {
  const events = await prisma.event.findMany({ where: { status: EventStatus.PUBLISHED, startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, include: { group: true, rsvps: { select: { userId: true, status: true } } } });
  return NextResponse.json({ events: events.map((event) => ({ id: event.id, title: event.title, startsAt: event.startsAt, location: event.location, format: event.format, playerCap: event.playerCap, group: event.group?.name ?? "Open play", going: event.rsvps.filter((rsvp) => rsvp.status === "GOING").length })) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a game." }, { status: 401 });
  const profile = await ensureProfile(user);
  const body = await request.json();
  const startsAt = new Date(body.startsAt);
  const playerCap = Number(body.playerCap);
  if (!body.title || !body.location || Number.isNaN(startsAt.getTime()) || !Number.isInteger(playerCap) || playerCap < 2 || playerCap > 100) return NextResponse.json({ error: "Enter a title, location, date, and player cap between 2 and 100." }, { status: 400 });
  // Optional: a game can belong to one of the organizer's groups instead of being open play.
  const groupId = typeof body.groupId === "string" && body.groupId ? body.groupId : null;
  let group: { name: string } | null = null;
  if (groupId) {
    const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: profile.id } } });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) return NextResponse.json({ error: "Join this group before creating a game for it." }, { status: 403 });
    group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true } });
  }
  const event = await prisma.event.create({ data: { title: body.title, location: body.location, startsAt, playerCap, courtCount: Number(body.courtCount) || 1, format: Object.values(EventFormat).includes(body.format) ? body.format : EventFormat.DOUBLES, status: EventStatus.PUBLISHED, createdById: profile.id, groupId } });
  // Let the rest of the group know (shows under Activity; the game itself appears under Invites).
  if (groupId && group) {
    const members = await prisma.membership.findMany({ where: { groupId, status: MembershipStatus.ACTIVE, userId: { not: profile.id } }, select: { userId: true } });
    await Promise.all(members.map((member) => notify(member.userId, "general", "EVENT_CREATED", `New game in ${group.name}`, `${profile.name} posted ${event.title} at ${event.location}. Check your invites to join or pass.`)));
  }
  return NextResponse.json({ event: { ...event, group: group?.name ?? "Open play" } }, { status: 201 });
}
