import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = await context.params;

  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId }, select: { groupId: true, createdById: true } });
  if (!roundRobin) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  if (roundRobin.groupId) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const membership = user ? await prisma.membership.findUnique({ where: { groupId_userId: { groupId: roundRobin.groupId, userId: user.id } } }) : null;
    const isGroupMember = Boolean(membership && membership.status === MembershipStatus.ACTIVE);
    if (!isGroupMember && roundRobin.createdById !== user?.id) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  }

  const matches = await prisma.match.findMany({ where: { roundRobinId, deletedAt: null }, include: { players: { include: { user: { select: { id: true, name: true } } } }, scores: true } });
  const stats = new Map<string, { userId: string; name: string; wins: number; losses: number; scored: number; conceded: number }>();
  for (const match of matches) for (const player of match.players) if (!stats.has(player.userId)) stats.set(player.userId, { userId: player.userId, name: player.user.name, wins: 0, losses: 0, scored: 0, conceded: 0 });
  for (const match of matches) for (const score of match.scores) { for (const player of match.players) { const entry = stats.get(player.userId)!; const own = player.side === "A" ? score.sideAScore : score.sideBScore; const other = player.side === "A" ? score.sideBScore : score.sideAScore; entry.scored += own; entry.conceded += other; if (own > other) entry.wins += 1; else entry.losses += 1; } }
  const standings = [...stats.values()].sort((a, b) => b.wins - a.wins || (b.scored - b.conceded) - (a.scored - a.conceded)).map((entry, index) => ({ rank: index + 1, ...entry, differential: entry.scored - entry.conceded }));
  return NextResponse.json({ standings });
}
