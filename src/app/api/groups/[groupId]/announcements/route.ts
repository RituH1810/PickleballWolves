import { NextResponse } from "next/server";
import { MembershipRole, MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { ANNOUNCEMENT_BODY_MAX as BODY_MAX, ANNOUNCEMENT_TITLE_MAX as TITLE_MAX } from "@/lib/announcements";

async function getMembership(groupId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, membership: null };
  const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  return { user, membership: membership?.status === MembershipStatus.ACTIVE ? membership : null };
}

// Announcements are group-private, like round robins: active members only.
export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;
  const { user, membership } = await getMembership(groupId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!membership) return NextResponse.json({ error: "Join this group to see its announcements." }, { status: 403 });

  const announcements = await prisma.announcement.findMany({ where: { groupId }, orderBy: { createdAt: "desc" }, take: 20 });
  // Announcement stores authorId without a relation, so resolve names in one batch.
  const authors = await prisma.user.findMany({ where: { id: { in: [...new Set(announcements.map((announcement) => announcement.authorId))] } }, select: { id: true, name: true, photoUrl: true } });
  const authorById = new Map(authors.map((author) => [author.id, author]));
  const isOrganizer = membership.role === MembershipRole.ORGANIZER;

  return NextResponse.json({
    canPost: isOrganizer,
    announcements: announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      createdAt: announcement.createdAt,
      author: authorById.get(announcement.authorId) ?? { id: announcement.authorId, name: "Former member", photoUrl: null },
      canDelete: isOrganizer || announcement.authorId === user.id,
    })),
  });
}

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;
  const { user, membership } = await getMembership(groupId);
  if (!user) return NextResponse.json({ error: "Sign in to post an announcement." }, { status: 401 });
  if (membership?.role !== MembershipRole.ORGANIZER) return NextResponse.json({ error: "Only group organizers can post announcements." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!title || !text) return NextResponse.json({ error: "Add a title and a message." }, { status: 400 });
  if (title.length > TITLE_MAX || text.length > BODY_MAX) return NextResponse.json({ error: `Keep the title under ${TITLE_MAX} characters and the message under ${BODY_MAX}.` }, { status: 400 });

  const [announcement, group, author, members] = await Promise.all([
    prisma.announcement.create({ data: { groupId, authorId: user.id, title, body: text } }),
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { id: true, name: true, photoUrl: true } }),
    prisma.membership.findMany({ where: { groupId, status: MembershipStatus.ACTIVE, userId: { not: user.id } }, select: { userId: true } }),
  ]);

  const preview = text.length > 140 ? `${text.slice(0, 137)}...` : text;
  await Promise.all(members.map((member) => notify(member.userId, "general", "GROUP_ANNOUNCEMENT", `${group?.name ?? "Your group"}: ${title}`, preview)));

  return NextResponse.json({
    announcement: { id: announcement.id, title: announcement.title, body: announcement.body, createdAt: announcement.createdAt, author: author ?? { id: user.id, name: "You", photoUrl: null }, canDelete: true },
  }, { status: 201 });
}
