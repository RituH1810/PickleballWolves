import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isRoundRobinParticipant } from "@/lib/round-robin-access";
import { loadRecap } from "@/lib/load-recap";

// Same visibility as the standings: group round robins are for group members (and the organizer).
export async function GET(_request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = await context.params;

  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId }, select: { groupId: true, createdById: true, name: true, status: true } });
  if (!roundRobin) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  if (roundRobin.groupId) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const membership = user ? await prisma.membership.findUnique({ where: { groupId_userId: { groupId: roundRobin.groupId, userId: user.id } } }) : null;
    const isGroupMember = Boolean(membership && membership.status === MembershipStatus.ACTIVE);
    if (!isGroupMember && roundRobin.createdById !== user?.id && !(user && await isRoundRobinParticipant(roundRobinId, user.id))) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  }

  return NextResponse.json({ name: roundRobin.name, status: roundRobin.status, recap: await loadRecap(roundRobinId) });
}
