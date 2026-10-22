import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { GUEST_NAME_MAX, GUEST_RATING_MAX, GUEST_RATING_MIN } from "@/lib/guest-players";

async function organizerRoundRobin(roundRobinId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in to manage players." }, { status: 401 }) };
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId }, select: { id: true, createdById: true } });
  if (!roundRobin) return { error: NextResponse.json({ error: "Round robin not found." }, { status: 404 }) };
  if (roundRobin.createdById !== user.id) return { error: NextResponse.json({ error: "Only the organizer can add guests." }, { status: 403 }) };
  return { userId: user.id };
}

// Guests this organizer has brought to any of their round robins before, so a regular guest can be
// re-added (keeping one history and rating) instead of typed in again as a new player.
export async function GET(_request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const access = await organizerRoundRobin((await context.params).roundRobinId);
  if ("error" in access) return access.error;
  const guests = await prisma.user.findMany({
    where: { isGuest: true, roundRobinRsvps: { some: { roundRobin: { createdById: access.userId } } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, skillRating: true },
  });
  return NextResponse.json({ guests: guests.map((guest) => ({ ...guest, skillRating: Number(guest.skillRating) })) });
}

// Adds someone without a PickleballWolves account: a name-only guest player, joined straight to
// the roster. With guestId, re-adds one of the organizer's earlier guests instead.
export async function POST(request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = await context.params;
  const access = await organizerRoundRobin(roundRobinId);
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);

  let guestId: string;
  if (typeof body?.guestId === "string") {
    const known = await prisma.user.findFirst({ where: { id: body.guestId, isGuest: true, roundRobinRsvps: { some: { roundRobin: { createdById: access.userId } } } }, select: { id: true } });
    if (!known) return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    guestId = known.id;
  } else {
    const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    const rating = Number(body?.skillRating);
    if (!name || name.length > GUEST_NAME_MAX) return NextResponse.json({ error: `Enter the guest's name (up to ${GUEST_NAME_MAX} characters).` }, { status: 400 });
    if (!Number.isFinite(rating) || rating < GUEST_RATING_MIN || rating > GUEST_RATING_MAX) return NextResponse.json({ error: `Pick a skill rating from ${GUEST_RATING_MIN.toFixed(1)} to ${GUEST_RATING_MAX.toFixed(1)}.` }, { status: 400 });
    // Email is required and unique, but a guest never signs in or gets mail -- .invalid can't deliver.
    const guest = await prisma.user.create({ data: { name, email: `guest-${randomUUID()}@guests.pickleballwolves.invalid`, skillRating: Math.round(rating * 10) / 10, isGuest: true } });
    guestId = guest.id;
  }

  await prisma.roundRobinRSVP.upsert({
    where: { roundRobinId_userId: { roundRobinId, userId: guestId } },
    update: { status: "JOINED", respondedAt: new Date() },
    create: { roundRobinId, userId: guestId, status: "JOINED", respondedAt: new Date() },
  });
  return NextResponse.json({ guestId });
}
