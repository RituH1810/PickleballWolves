import { NextResponse } from "next/server";
import { MembershipRole, MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";

// A group organizer makes a member a co-organizer (role ORGANIZER) or back to a member. Co-organizers
// can run every round robin in the group and post announcements, recurring games, and polls. The
// group's creator always stays an organizer.
export async function PATCH(request: Request, context: { params: Promise<{ groupId: string; userId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage organizers." }, { status: 401 });
  const { groupId, userId } = await context.params;
  const body = await request.json().catch(() => null);
  const role = body?.role === "ORGANIZER" ? MembershipRole.ORGANIZER : body?.role === "MEMBER" ? MembershipRole.MEMBER : null;
  if (!role) return NextResponse.json({ error: "Pick organizer or member." }, { status: 400 });

  const [group, mine, target] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true, createdById: true } }),
    prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } }),
    prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId } } }),
  ]);
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  if (mine?.status !== MembershipStatus.ACTIVE || mine.role !== MembershipRole.ORGANIZER) return NextResponse.json({ error: "Only group organizers can change this." }, { status: 403 });
  if (target?.status !== MembershipStatus.ACTIVE) return NextResponse.json({ error: "That player isn't an active member of this group." }, { status: 404 });
  if (role === MembershipRole.MEMBER && userId === group.createdById) return NextResponse.json({ error: "The group's creator is always an organizer." }, { status: 400 });
  if (target.role === role) return NextResponse.json({ role });

  await prisma.membership.update({ where: { id: target.id }, data: { role } });
  if (role === MembershipRole.ORGANIZER && userId !== user.id) {
    await notify(userId, "general", "GROUP_CO_ORGANIZER", `You're now a co-organizer of ${group.name}`, "You can run the group's round robins, post announcements, and set up recurring games.", `/groups/${groupId}`);
  }
  return NextResponse.json({ role });
}
