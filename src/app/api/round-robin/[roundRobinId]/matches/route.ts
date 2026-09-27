import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a match." }, { status: 401 });
  const { roundRobinId } = await context.params;
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId } });
  if (!roundRobin) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  if (!roundRobin.groupId) return NextResponse.json({ error: "Manual matches are only available for group round robins." }, { status: 400 });

  // Same permission model as starting/extending the schedule: organizer or any active group member.
  let canManage = roundRobin.createdById === user.id;
  if (!canManage) {
    const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId: roundRobin.groupId, userId: user.id } } });
    canManage = membership?.status === MembershipStatus.ACTIVE;
  }
  if (!canManage) return NextResponse.json({ error: "Only the organizer or a group member can create a match." }, { status: 403 });

  const body = await request.json();
  const teamA: unknown = body.teamA;
  const teamB: unknown = body.teamB;
  if (!Array.isArray(teamA) || !Array.isArray(teamB) || !teamA.every((id) => typeof id === "string") || !teamB.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "Pick players for both sides of the match." }, { status: 400 });
  }
  const expectedSize = roundRobin.playFormat === "SINGLES" ? 1 : 2;
  if (teamA.length !== expectedSize || teamB.length !== expectedSize) {
    return NextResponse.json({ error: `Each side needs exactly ${expectedSize} player${expectedSize === 1 ? "" : "s"} for ${roundRobin.playFormat.toLowerCase()}.` }, { status: 400 });
  }
  const allIds = [...teamA, ...teamB];
  if (new Set(allIds).size !== allIds.length) return NextResponse.json({ error: "A player can't be on both sides." }, { status: 400 });

  // Trust the organizer/group member's picks the same way generating a schedule does -- players
  // don't need to have separately RSVP'd JOINED, just be active members of the group.
  const members = await prisma.membership.findMany({ where: { groupId: roundRobin.groupId, status: MembershipStatus.ACTIVE }, select: { userId: true } });
  const memberIds = new Set(members.map((membership) => membership.userId));
  if (allIds.some((id) => !memberIds.has(id))) return NextResponse.json({ error: "Every selected player must be a member of the group." }, { status: 400 });

  const courtNumber = Number.isInteger(Number(body.courtNumber)) && Number(body.courtNumber) > 0 ? Number(body.courtNumber) : 1;
  const match = await prisma.match.create({
    data: {
      roundRobinId,
      courtNumber,
      scheduledAt: roundRobin.scheduledAt ?? new Date(),
      players: { create: [...teamA.map((userId) => ({ userId, side: "A" as const })), ...teamB.map((userId) => ({ userId, side: "B" as const }))] },
    },
  });
  if (roundRobin.status === "SETUP") await prisma.roundRobin.update({ where: { id: roundRobinId }, data: { status: "LIVE" } });

  return NextResponse.json({ match }, { status: 201 });
}
