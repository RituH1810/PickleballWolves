import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pollViewer } from "@/lib/polls";

// Organizer closes a poll without scheduling anything.
export async function DELETE(_request: Request, context: { params: Promise<{ groupId: string; pollId: string }> }) {
  const { groupId, pollId } = await context.params;
  const viewer = await pollViewer(groupId);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!viewer.isOrganizer) return NextResponse.json({ error: "Only group organizers can close a poll." }, { status: 403 });
  const closed = await prisma.availabilityPoll.updateMany({ where: { id: pollId, groupId, status: "OPEN" }, data: { status: "CLOSED" } });
  if (!closed.count) return NextResponse.json({ error: "Poll not found or already closed." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
