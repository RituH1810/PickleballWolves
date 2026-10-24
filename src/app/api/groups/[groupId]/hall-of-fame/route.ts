import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { loadHallOfFame } from "@/lib/load-hall-of-fame";

// The group's all-time records. Members only, like the rest of the group's results.
export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to see the Hall of Fame." }, { status: 401 });
  const [group, membership] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } }),
  ]);
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  if (membership?.status !== MembershipStatus.ACTIVE) return NextResponse.json({ error: "Join this group to see its Hall of Fame." }, { status: 403 });

  return NextResponse.json({ groupName: group.name, records: await loadHallOfFame(groupId) });
}
