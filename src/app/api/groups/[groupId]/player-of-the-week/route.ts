import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { weekLabel } from "@/lib/player-of-the-week";

const WEEKS_SHOWN = 6;

// The group's recent Players of the Week, newest week first. Members only.
export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  if (membership?.status !== MembershipStatus.ACTIVE) return NextResponse.json({ error: "Join this group to see its awards." }, { status: 403 });

  const recentWeeks = await prisma.playerOfTheWeek.findMany({ where: { groupId }, distinct: ["weekStart"], orderBy: { weekStart: "desc" }, take: WEEKS_SHOWN, select: { weekStart: true } });
  const rows = recentWeeks.length ? await prisma.playerOfTheWeek.findMany({ where: { groupId, weekStart: { in: recentWeeks.map((week) => week.weekStart) } }, orderBy: [{ weekStart: "desc" }, { createdAt: "asc" }] }) : [];
  const people = new Map((await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.userId))] } }, select: { id: true, name: true, photoUrl: true } })).map((person) => [person.id, person]));
  const counts = new Map<string, number>();
  for (const row of await prisma.playerOfTheWeek.findMany({ where: { groupId }, select: { userId: true } })) counts.set(row.userId, (counts.get(row.userId) ?? 0) + 1);

  return NextResponse.json({
    weeks: recentWeeks.map(({ weekStart }) => ({
      weekStart,
      label: weekLabel(weekStart),
      winners: rows.filter((row) => row.weekStart.getTime() === weekStart.getTime()).map((row) => ({ userId: row.userId, name: people.get(row.userId)?.name ?? "Player", photoUrl: people.get(row.userId)?.photoUrl ?? null, matches: row.matches, wins: row.wins, losses: row.losses, avgPointDiff: row.avgPointDiff, timesWon: counts.get(row.userId) ?? 1 })),
    })),
  });
}
