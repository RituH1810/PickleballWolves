import { NextResponse } from "next/server";
import { MembershipStatus, RoundRobinRsvpStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

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
  return NextResponse.json({ status: rsvp.status, userId: targetUserId });
}
