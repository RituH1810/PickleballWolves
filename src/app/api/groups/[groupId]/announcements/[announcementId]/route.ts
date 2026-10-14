import { NextResponse } from "next/server";
import { MembershipRole, MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// Organizers can remove any announcement; authors can remove their own.
export async function DELETE(_request: Request, context: { params: Promise<{ groupId: string; announcementId: string }> }) {
  const { groupId, announcementId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [announcement, membership] = await Promise.all([
    prisma.announcement.findUnique({ where: { id: announcementId } }),
    prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } }),
  ]);
  if (!announcement || announcement.groupId !== groupId) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  const isOrganizer = membership?.status === MembershipStatus.ACTIVE && membership.role === MembershipRole.ORGANIZER;
  if (!isOrganizer && announcement.authorId !== user.id) return NextResponse.json({ error: "Only organizers can remove announcements." }, { status: 403 });

  await prisma.announcement.delete({ where: { id: announcementId } });
  return NextResponse.json({ ok: true });
}
