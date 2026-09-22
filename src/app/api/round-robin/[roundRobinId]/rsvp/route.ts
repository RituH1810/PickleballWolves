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

  const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId: roundRobin.groupId, userId: user.id } } });
  if (!membership || membership.status !== MembershipStatus.ACTIVE) return NextResponse.json({ error: "Join the group to RSVP for this round robin." }, { status: 403 });

  const body = await request.json();
  if (!["JOINED", "DECLINED"].includes(body.status)) return NextResponse.json({ error: "Invalid RSVP status." }, { status: 400 });

  const rsvp = await prisma.roundRobinRSVP.upsert({
    where: { roundRobinId_userId: { roundRobinId, userId: user.id } },
    update: { status: body.status as RoundRobinRsvpStatus, respondedAt: new Date() },
    create: { roundRobinId, userId: user.id, status: body.status as RoundRobinRsvpStatus },
  });
  return NextResponse.json({ status: rsvp.status });
}
