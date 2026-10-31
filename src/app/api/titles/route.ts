import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { loadTitleTimeline } from "@/lib/load-recap";

// A player's round robin titles, newest first. Defaults to the signed-in player; ?userId= for others.
// Titles from a private group the viewer isn't in (or from a game outside any group) are left out,
// like awards.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = new URL(request.url).searchParams.get("userId") || user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const titles = await loadTitleTimeline(userId);
  const groupIds = [...new Set(titles.flatMap((title) => (title.group ? [title.group.id] : [])))];
  const myGroups = user && userId !== user.id ? new Set((await prisma.membership.findMany({ where: { userId: user.id, status: MembershipStatus.ACTIVE, groupId: { in: groupIds } }, select: { groupId: true } })).map((membership) => membership.groupId)) : new Set<string>();
  const visible = titles.filter((title) => userId === user?.id || (title.group && (title.group.visibility === "PUBLIC" || myGroups.has(title.group.id))));
  return NextResponse.json({ titles: visible.map(({ group, ...title }) => ({ ...title, groupName: group?.name ?? null })) });
}
