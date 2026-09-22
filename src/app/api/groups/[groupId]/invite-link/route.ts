import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const INVITE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

// Returns a persistent, shareable invite link for the group (WhatsApp/SMS/anywhere) --
// reuses an existing unexpired one if present, rather than minting a new token every time.
export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to invite players." }, { status: 401 });
  const { groupId } = await context.params;

  const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  if (!membership || membership.status !== MembershipStatus.ACTIVE) return NextResponse.json({ error: "Join this group before inviting others." }, { status: 403 });

  let invite = await prisma.groupInvite.findFirst({ where: { groupId, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!invite) {
    invite = await prisma.groupInvite.create({ data: { groupId, invitedEmail: user.email ?? "", token: randomUUID(), expiresAt: new Date(Date.now() + INVITE_TTL_MS), createdById: user.id } });
  }

  const origin = new URL(request.url).origin;
  return NextResponse.json({ url: `${origin}/invite/accept?token=${invite.token}` });
}
