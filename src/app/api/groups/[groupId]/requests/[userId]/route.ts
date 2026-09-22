import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ groupId: string; userId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage join requests." }, { status: 401 });
  const { groupId, userId } = await context.params;

  const myMembership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  if (!myMembership || myMembership.status !== MembershipStatus.ACTIVE) return NextResponse.json({ error: "Only group members can approve or decline join requests." }, { status: 403 });

  const body = await request.json();
  if (!["ACTIVE", "DECLINED"].includes(body.status)) return NextResponse.json({ error: "Invalid response." }, { status: 400 });

  const target = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!target || target.status !== MembershipStatus.PENDING) return NextResponse.json({ error: "This join request is no longer pending." }, { status: 404 });

  const updated = await prisma.membership.update({
    where: { groupId_userId: { groupId, userId } },
    data: body.status === "ACTIVE" ? { status: MembershipStatus.ACTIVE, joinedAt: new Date() } : { status: MembershipStatus.DECLINED },
  });
  return NextResponse.json({ status: updated.status });
}
