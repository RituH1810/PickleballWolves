import { NextResponse } from "next/server";
import { MembershipRole, MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";

async function getSignedInUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const user = await getSignedInUser();
  if (!user) return NextResponse.json({ error: "Sign in to request to join a group." }, { status: 401 });
  const { groupId } = await context.params;
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  const profile = await ensureProfile(user);
  const membership = await prisma.membership.upsert({
    where: { groupId_userId: { groupId, userId: profile.id } },
    update: { status: MembershipStatus.PENDING },
    create: { groupId, userId: profile.id, role: MembershipRole.MEMBER, status: MembershipStatus.PENDING },
  });
  return NextResponse.json({ status: membership.status });
}

export async function DELETE(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const user = await getSignedInUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage your membership." }, { status: 401 });
  const { groupId } = await context.params;
  const profile = await ensureProfile(user);
  await prisma.membership.deleteMany({ where: { groupId, userId: profile.id } });
  return NextResponse.json({ status: "LEFT" });
}
