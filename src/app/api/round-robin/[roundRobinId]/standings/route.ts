import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isRoundRobinParticipant } from "@/lib/round-robin-access";
import { computeRoundRobinStandings } from "@/lib/round-robin-recap";

export async function GET(_request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = await context.params;

  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId }, select: { groupId: true, createdById: true } });
  if (!roundRobin) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  if (roundRobin.groupId) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const membership = user ? await prisma.membership.findUnique({ where: { groupId_userId: { groupId: roundRobin.groupId, userId: user.id } } }) : null;
    const isGroupMember = Boolean(membership && membership.status === MembershipStatus.ACTIVE);
    if (!isGroupMember && roundRobin.createdById !== user?.id && !(user && await isRoundRobinParticipant(roundRobinId, user.id))) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  }

  const matches = await prisma.match.findMany({ where: { roundRobinId, deletedAt: null }, include: { players: { include: { user: { select: { id: true, name: true } } } }, scores: true } });
  const standings = computeRoundRobinStandings(matches.map((match) => ({ id: match.id, players: match.players.map((player) => ({ userId: player.userId, name: player.user.name, side: player.side })), scores: match.scores })));
  return NextResponse.json({ standings });
}
