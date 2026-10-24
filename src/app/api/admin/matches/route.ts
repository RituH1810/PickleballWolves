import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const matches = await prisma.match.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100, include: { scores: true, players: { include: { user: { select: { name: true } } } } } });
  return NextResponse.json({ matches });
}

export async function DELETE(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { matchId } = await request.json();
  await prisma.match.update({ where: { id: matchId }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
