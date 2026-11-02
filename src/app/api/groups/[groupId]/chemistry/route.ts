import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { loadGroupRoundRobins } from "@/lib/load-hall-of-fame";
import { computeChemistry } from "@/lib/chemistry";
import { DUO_MIN_GAMES } from "@/lib/hall-of-fame";

// Every pair's record together in the group. Members only, like the rest of the group's results.
export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to see the chemistry grid." }, { status: 401 });
  const [group, membership] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } }),
  ]);
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  if (membership?.status !== MembershipStatus.ACTIVE) return NextResponse.json({ error: "Join this group to see its chemistry grid." }, { status: 403 });

  const { roundRobins, guestIds } = await loadGroupRoundRobins(groupId);
  const chemistry = computeChemistry(roundRobins, guestIds);
  const photos = await prisma.user.findMany({ where: { id: { in: chemistry.players.map((player) => player.userId) } }, select: { id: true, photoUrl: true } });
  const photoOf = new Map(photos.map((row) => [row.id, row.photoUrl]));
  return NextResponse.json({
    groupName: group.name,
    myId: user.id,
    minGames: DUO_MIN_GAMES,
    ...chemistry,
    players: chemistry.players.map((player) => ({ ...player, photoUrl: photoOf.get(player.userId) ?? null })),
  });
}
