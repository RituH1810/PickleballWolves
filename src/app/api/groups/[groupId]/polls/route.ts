import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { isValidTimeZone } from "@/lib/recurring";
import { loadPoll, pollViewer, POLL_MAX_OPTIONS, POLL_MIN_OPTIONS } from "@/lib/polls";

// The group's open polls plus the last few finished ones, newest first. Members only.
export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;
  const viewer = await pollViewer(groupId);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!viewer.isMember) return NextResponse.json({ error: "Join this group to see its polls." }, { status: 403 });

  const [open, finished] = await Promise.all([
    prisma.availabilityPoll.findMany({ where: { groupId, status: "OPEN" }, orderBy: { createdAt: "desc" }, select: { id: true } }),
    prisma.availabilityPoll.findMany({ where: { groupId, status: { not: "OPEN" } }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true } }),
  ]);
  const polls = await Promise.all([...open, ...finished].map((poll) => loadPoll(poll.id, viewer.userId)));
  return NextResponse.json({ canCreate: viewer.isOrganizer, polls: polls.filter(Boolean) });
}

// Organizer asks "who can play?" with 2-6 future date/time options; every member is notified.
export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;
  const viewer = await pollViewer(groupId);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!viewer.isOrganizer) return NextResponse.json({ error: "Only group organizers can ask for availability." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" && body.question.trim() ? body.question.trim().slice(0, 120) : "When can you play?";
  const timeZone = typeof body?.timeZone === "string" && isValidTimeZone(body.timeZone) ? body.timeZone : "America/New_York";
  const now = Date.now();
  const times = Array.isArray(body?.options) ? [...new Set<number>(body.options.map((value: unknown) => new Date(String(value)).getTime()).filter((time: number) => Number.isFinite(time) && time > now))].sort((a, b) => a - b) : [];
  if (times.length < POLL_MIN_OPTIONS || times.length > POLL_MAX_OPTIONS) return NextResponse.json({ error: `Add ${POLL_MIN_OPTIONS}-${POLL_MAX_OPTIONS} different future times.` }, { status: 400 });

  const [poll, group, author, members] = await Promise.all([
    prisma.availabilityPoll.create({ data: { groupId, createdById: viewer.userId, question, timeZone, options: { create: times.map((time) => ({ startsAt: new Date(time) })) } } }),
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: viewer.userId }, select: { name: true } }),
    prisma.membership.findMany({ where: { groupId, status: MembershipStatus.ACTIVE, userId: { not: viewer.userId } }, select: { userId: true } }),
  ]);
  await Promise.all(members.map((member) => notify(member.userId, "general", "AVAILABILITY_POLL", `${group?.name ?? "Your group"}: ${question}`, `${author?.name ?? "An organizer"} wants to know which times work. Tap the ones you can make.`, `/groups/${groupId}#polls`)));
  return NextResponse.json({ poll: await loadPoll(poll.id, viewer.userId) }, { status: 201 });
}
