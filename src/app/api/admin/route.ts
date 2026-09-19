import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (admin?.role !== UserRole.ADMIN) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const [users, groups, events] = await Promise.all([prisma.user.count(), prisma.group.count(), prisma.event.count()]);
  return NextResponse.json({ stats: { users, groups, events } });
}
