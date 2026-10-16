import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pollViewer } from "@/lib/polls";
import { createGroupRoundRobin } from "@/lib/create-group-round-robin";

// Organizer turns one option into a round robin: everyone who said that time works is joined
// automatically, the rest of the group is invited, and the poll closes.
export async function POST(request: Request, context: { params: Promise<{ groupId: string; pollId: string }> }) {
  const { groupId, pollId } = await context.params;
  const viewer = await pollViewer(groupId);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!viewer.isOrganizer) return NextResponse.json({ error: "Only group organizers can schedule from a poll." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const poll = await prisma.availabilityPoll.findUnique({ where: { id: pollId }, include: { options: { include: { votes: { select: { userId: true } } } } } });
  if (!poll || poll.groupId !== groupId) return NextResponse.json({ error: "Poll not found." }, { status: 404 });
  if (poll.status !== "OPEN") return NextResponse.json({ error: "This poll is already closed." }, { status: 400 });
  const option = poll.options.find((entry) => entry.id === body?.optionId);
  if (!option) return NextResponse.json({ error: "Pick one of the poll's times." }, { status: 400 });
  if (option.startsAt.getTime() < Date.now()) return NextResponse.json({ error: "That time has already passed." }, { status: 400 });

  // Claim the poll first so two clicks can't create two games.
  const claimed = await prisma.availabilityPoll.updateMany({ where: { id: pollId, status: "OPEN" }, data: { status: "SCHEDULED" } });
  if (!claimed.count) return NextResponse.json({ error: "This poll is already closed." }, { status: 400 });

  const [group, organizer] = await Promise.all([
    prisma.group.findUniqueOrThrow({ where: { id: groupId }, select: { id: true, name: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: viewer.userId }, select: { id: true, name: true } }),
  ]);
  const courtCount = Number(body?.courtCount);
  const roundRobin = await createGroupRoundRobin({
    group,
    organizer,
    scheduledAt: option.startsAt,
    timeZone: poll.timeZone,
    playFormat: ["SINGLES", "DOUBLES", "MIXED"].includes(body?.playFormat) ? body.playFormat : "DOUBLES",
    partnerFormat: ["ROTATE", "FIXED", "MANUAL"].includes(body?.partnerFormat) ? body.partnerFormat : "MANUAL",
    courtCount: Number.isInteger(courtCount) && courtCount >= 1 && courtCount <= 20 ? courtCount : 1,
    pointsToWin: [11, 15, 21].includes(Number(body?.pointsToWin)) ? Number(body.pointsToWin) : 11,
    joinIds: option.votes.map((vote) => vote.userId),
    joinedReason: "You said this time works in the availability poll, so you've been added.",
  });
  await prisma.availabilityPoll.update({ where: { id: pollId }, data: { scheduledRoundRobinId: roundRobin.id } });
  return NextResponse.json({ roundRobinId: roundRobin.id, joined: option.votes.length }, { status: 201 });
}
