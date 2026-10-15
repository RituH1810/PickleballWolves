import { NextResponse } from "next/server";
import { MembershipStatus, RoundRobinRsvpStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";

export async function POST(request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to RSVP for this round robin." }, { status: 401 });
  const { roundRobinId } = await context.params;

  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId } });
  if (!roundRobin) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  if (!roundRobin.groupId) return NextResponse.json({ error: "This round robin isn't open for RSVPs." }, { status: 400 });

  const body = await request.json();
  if (!["JOINED", "DECLINED"].includes(body.status)) return NextResponse.json({ error: "Invalid RSVP status." }, { status: 400 });

  // The organizer can RSVP on behalf of any active group member -- e.g. adding someone to a
  // Dink Draft round robin's roster directly, instead of waiting for them to self-RSVP.
  const targetUserId = typeof body.userId === "string" && body.userId ? body.userId : user.id;
  if (targetUserId !== user.id && roundRobin.createdById !== user.id) {
    return NextResponse.json({ error: "Only the organizer can RSVP on someone else's behalf." }, { status: 403 });
  }

  const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId: roundRobin.groupId, userId: targetUserId } } });
  if (!membership || membership.status !== MembershipStatus.ACTIVE) return NextResponse.json({ error: "That player isn't an active member of this group." }, { status: 403 });

  const rsvp = await prisma.roundRobinRSVP.upsert({
    where: { roundRobinId_userId: { roundRobinId, userId: targetUserId } },
    update: { status: body.status as RoundRobinRsvpStatus, respondedAt: new Date() },
    create: { roundRobinId, userId: targetUserId, status: body.status as RoundRobinRsvpStatus },
  });
  if (targetUserId !== user.id && body.status === "JOINED") {
    await notify(targetUserId, "general", "ADDED_TO_ROUND_ROBIN", "You were added to a round robin", `The organizer added you to ${roundRobin.name}.`);
  }
  return NextResponse.json({ status: rsvp.status, userId: targetUserId });
}

// Organizer removes someone from the roster (e.g. they said they'd come but didn't show). Deleting
// the RSVP rather than marking it DECLINED leaves them free to join again themselves.
export async function DELETE(request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage this round robin." }, { status: 401 });
  const { roundRobinId } = await context.params;

  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId } });
  if (!roundRobin) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  if (roundRobin.createdById !== user.id) return NextResponse.json({ error: "Only the organizer can remove players." }, { status: 403 });
  if (roundRobin.status === "COMPLETED") return NextResponse.json({ error: "This round robin has already ended." }, { status: 400 });

  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Pick a player to remove." }, { status: 400 });

  const removed = await prisma.roundRobinRSVP.deleteMany({ where: { roundRobinId, userId } });
  if (!removed.count) return NextResponse.json({ error: "That player isn't on the roster." }, { status: 404 });

  // Matches already created with them stay put -- the organizer decides whether to delete those.
  const matchCount = await prisma.match.count({ where: { roundRobinId, deletedAt: null, players: { some: { userId } } } });
  if (userId !== user.id) await notify(userId, "general", "REMOVED_FROM_ROUND_ROBIN", "You were removed from a round robin", `The organizer removed you from ${roundRobin.name}. You can join again from your invites if plans change.`);
  return NextResponse.json({ ok: true, matchCount });
}
