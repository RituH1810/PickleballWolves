import { NextResponse } from "next/server";
import { EventFormat, EventStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";

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
  const event = await prisma.event.create({ data: { title: body.title, location: body.location, startsAt, playerCap, courtCount: Number(body.courtCount) || 1, format: Object.values(EventFormat).includes(body.format) ? body.format : EventFormat.DOUBLES, status: EventStatus.PUBLISHED, createdById: profile.id } });
  return NextResponse.json({ event }, { status: 201 });
}
