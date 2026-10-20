import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { AWARD_LABELS, monthLabel, type AwardKind } from "@/lib/monthly-awards";
import { weekLabel } from "@/lib/player-of-the-week";

// A player's monthly awards, newest first. Defaults to the signed-in player; ?userId= for others.
// Awards from a private group the viewer isn't in are left out.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = new URL(request.url).searchParams.get("userId") || user.id;

  const [awards, weekly] = await Promise.all([
    prisma.monthlyAward.findMany({ where: { userId }, orderBy: [{ month: "desc" }, { award: "asc" }] }),
    prisma.playerOfTheWeek.findMany({ where: { userId }, orderBy: { weekStart: "desc" } }),
  ]);
  const groupIds = [...new Set([...awards.map((award) => award.groupId), ...weekly.map((entry) => entry.groupId)])];
  const partnerIds = [...new Set(awards.flatMap((award) => (award.partnerId ? [award.partnerId] : [])))];
  const [groups, partners, myGroups] = await Promise.all([
    prisma.group.findMany({ where: { id: { in: groupIds } }, select: { id: true, name: true, visibility: true } }),
    prisma.user.findMany({ where: { id: { in: partnerIds } }, select: { id: true, name: true } }),
    prisma.membership.findMany({ where: { userId: user.id, status: MembershipStatus.ACTIVE, groupId: { in: groupIds } }, select: { groupId: true } }),
  ]);
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const partnerById = new Map(partners.map((partner) => [partner.id, partner.name]));
  const visible = new Set([...groups.filter((group) => group.visibility === "PUBLIC").map((group) => group.id), ...myGroups.map((membership) => membership.groupId)]);

  const weeklyAwards = weekly.filter((entry) => userId === user.id || visible.has(entry.groupId)).map((entry) => ({
    id: entry.id,
    award: "PLAYER_OF_THE_WEEK",
    title: "Player of the Week",
    month: `Week of ${weekLabel(entry.weekStart)}`,
    groupName: groupById.get(entry.groupId)?.name ?? "Group",
    detail: `${entry.wins}-${entry.losses} in ${entry.matches} matches`,
    sortKey: entry.weekStart.toISOString(),
  }));
  return NextResponse.json({
    awards: [...weeklyAwards, ...awards.filter((award) => userId === user.id || visible.has(award.groupId)).map((award) => ({
      id: award.id,
      award: award.award,
      title: AWARD_LABELS[award.award as AwardKind]?.title ?? award.award,
      month: monthLabel(award.month),
      groupName: groupById.get(award.groupId)?.name ?? "Group",
      detail: award.partnerId ? `with ${partnerById.get(award.partnerId) ?? "partner"} · ${award.detail}` : award.detail,
      sortKey: `${award.month}-31`,
    }))].sort((a, b) => b.sortKey.localeCompare(a.sortKey)),
  });
}
