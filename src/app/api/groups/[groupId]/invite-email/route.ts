import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to invite players." }, { status: 401 });
  const { groupId } = await context.params;

  const myMembership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  if (!myMembership || myMembership.status !== MembershipStatus.ACTIVE) return NextResponse.json({ error: "Join this group before inviting others." }, { status: 403 });

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: existingUser.id } } });
    if (existingMembership?.status === MembershipStatus.ACTIVE) return NextResponse.json({ error: "That email is already in the group." }, { status: 400 });
  }

  const token = randomUUID();
  await prisma.groupInvite.create({ data: { groupId, invitedEmail: email, token, expiresAt: new Date(Date.now() + INVITE_TTL_MS), createdById: user.id } });

  const origin = new URL(request.url).origin;
  const nextPath = `/invite/accept?token=${token}`;
  const { error: otpError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: `${origin}${nextPath}` } });
  if (otpError) {
    console.error("Failed to send invite email", otpError);
    const isRateLimit = otpError.status === 429 || otpError.code === "over_email_send_rate_limit" || /rate limit/i.test(otpError.message);
    return NextResponse.json({ error: isRateLimit ? "We've hit our email limit for the moment. Please try again in a little while, or share the invite link instead." : "Unable to send the invite email. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ invitedEmail: email });
}
