import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadPoll, pollViewer } from "@/lib/polls";

// A member's picks: replaces their votes on this poll with the options sent (empty = none work).
export async function POST(request: Request, context: { params: Promise<{ groupId: string; pollId: string }> }) {
  const { groupId, pollId } = await context.params;
  const viewer = await pollViewer(groupId);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!viewer.isMember) return NextResponse.json({ error: "Join this group to vote." }, { status: 403 });

  const poll = await prisma.availabilityPoll.findUnique({ where: { id: pollId }, include: { options: { select: { id: true } } } });
  if (!poll || poll.groupId !== groupId) return NextResponse.json({ error: "Poll not found." }, { status: 404 });
  if (poll.status !== "OPEN") return NextResponse.json({ error: "This poll is closed." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const validIds = new Set(poll.options.map((option) => option.id));
  const picks = Array.isArray(body?.optionIds) ? [...new Set<string>(body.optionIds.filter((id: unknown): id is string => typeof id === "string" && validIds.has(id)))] : [];
  await prisma.$transaction([
    prisma.availabilityVote.deleteMany({ where: { userId: viewer.userId, optionId: { in: [...validIds] } } }),
    prisma.availabilityVote.createMany({ data: picks.map((optionId) => ({ optionId, userId: viewer.userId })) }),
  ]);
  return NextResponse.json({ poll: await loadPoll(pollId, viewer.userId) });
}
