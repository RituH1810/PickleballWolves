import { NextResponse } from "next/server";
import { RsvpStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";

async function getSignedInUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const user = await getSignedInUser();
  if (!user) return NextResponse.json({ error: "Sign in to join a game." }, { status: 401 });
  const profile = await ensureProfile(user);
  const { eventId } = await context.params;
  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { rsvps: { where: { status: RsvpStatus.GOING } } } });
  if (!event) return NextResponse.json({ error: "Game not found." }, { status: 404 });
  const existing = await prisma.rSVP.findUnique({ where: { eventId_userId: { eventId, userId: profile.id } } });
  if (existing?.status === RsvpStatus.GOING || existing?.status === RsvpStatus.WAITLISTED) return NextResponse.json({ status: existing.status });
  const status = event.rsvps.length < event.playerCap ? RsvpStatus.GOING : RsvpStatus.WAITLISTED;
  const rsvp = await prisma.rSVP.upsert({ where: { eventId_userId: { eventId, userId: profile.id } }, update: { status, respondedAt: new Date() }, create: { eventId, userId: profile.id, status } });
  return NextResponse.json({ status: rsvp.status });
}

export async function DELETE(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const user = await getSignedInUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage your RSVP." }, { status: 401 });
  const { eventId } = await context.params;
  const profile = await ensureProfile(user);
  await prisma.rSVP.updateMany({ where: { eventId, userId: profile.id }, data: { status: RsvpStatus.CANCELLED, respondedAt: new Date() } });
  const next = await prisma.rSVP.findFirst({ where: { eventId, status: RsvpStatus.WAITLISTED }, orderBy: { respondedAt: "asc" } });
  if (next) await prisma.rSVP.update({ where: { id: next.id }, data: { status: RsvpStatus.GOING, respondedAt: new Date() } });
  return NextResponse.json({ status: RsvpStatus.CANCELLED });
}
