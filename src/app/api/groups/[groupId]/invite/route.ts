import { NextResponse } from "next/server";
import { MembershipRole, MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to invite players." }, { status: 401 });
  const { groupId } = await context.params;

  const myMembership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  if (!myMembership || myMembership.status !== MembershipStatus.ACTIVE) return NextResponse.json({ error: "Join this group before inviting others." }, { status: 403 });

  const body = await request.json();
  const userIds: string[] = Array.isArray(body.userIds) ? body.userIds.filter((id: unknown): id is string => typeof id === "string") : [];
  if (!userIds.length) return NextResponse.json({ error: "Select at least one player to invite." }, { status: 400 });

  const validUsers = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } });
  const validIds = validUsers.map((validUser) => validUser.id);

  await prisma.$transaction(validIds.map((userId) => prisma.membership.upsert({
    where: { groupId_userId: { groupId, userId } },
    update: { status: MembershipStatus.ACTIVE, joinedAt: new Date() },
    create: { groupId, userId, role: MembershipRole.MEMBER, status: MembershipStatus.ACTIVE, joinedAt: new Date() },
  })));

  return NextResponse.json({ added: validIds.length });
}
