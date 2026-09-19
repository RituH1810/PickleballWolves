import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

async function isAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, role: true } });
  return admin?.role === UserRole.ADMIN ? admin : null;
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const matches = await prisma.match.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100, include: { scores: true, players: { include: { user: { select: { name: true } } } } } });
  return NextResponse.json({ matches });
}

export async function DELETE(request: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { matchId } = await request.json();
  await prisma.match.update({ where: { id: matchId }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
