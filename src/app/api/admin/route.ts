import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const [users, groups, events] = await Promise.all([prisma.user.count({ where: { isGuest: false } }), prisma.group.count(), prisma.event.count()]);
  return NextResponse.json({ stats: { users, groups, events } });
}
