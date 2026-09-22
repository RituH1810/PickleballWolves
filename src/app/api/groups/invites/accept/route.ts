import { NextResponse } from "next/server";
import { MembershipRole, MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to accept this invite." }, { status: 401 });

  const body = await request.json();
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) return NextResponse.json({ error: "Missing invite token." }, { status: 400 });

  const invite = await prisma.groupInvite.findUnique({ where: { token } });
  if (!invite) return NextResponse.json({ error: "This invite link is invalid." }, { status: 404 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "This invite has expired." }, { status: 400 });

  await ensureProfile(user);
  await prisma.membership.upsert({
    where: { groupId_userId: { groupId: invite.groupId, userId: user.id } },
    update: { status: MembershipStatus.ACTIVE, joinedAt: new Date() },
    create: { groupId: invite.groupId, userId: user.id, role: MembershipRole.MEMBER, status: MembershipStatus.ACTIVE, joinedAt: new Date() },
  });
  if (!invite.acceptedAt) await prisma.groupInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date(), invitedUserId: user.id } });

  return NextResponse.json({ groupId: invite.groupId });
}
