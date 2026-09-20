import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      memberships: { where: { status: MembershipStatus.ACTIVE }, orderBy: { joinedAt: "asc" }, include: { user: { select: { id: true, name: true, skillRating: true } } } },
      events: { where: { status: "PUBLISHED", startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 6 },
    },
  });
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  const myMembership = user ? group.memberships.find((membership) => membership.userId === user.id) : undefined;
  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      location: group.location,
      description: group.description,
      memberCount: group.memberships.length,
      members: group.memberships.map((membership) => ({ id: membership.user.id, name: membership.user.name, skillRating: membership.user.skillRating.toString(), role: membership.role })),
      events: group.events.map((event) => ({ id: event.id, title: event.title, startsAt: event.startsAt, location: event.location, format: event.format })),
      isMember: Boolean(myMembership),
      myRole: myMembership?.role ?? null,
    },
  });
}
