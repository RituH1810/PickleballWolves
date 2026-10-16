import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// Authors can delete their own messages; the organizer can delete any in their game.
export async function DELETE(_request: Request, context: { params: Promise<{ roundRobinId: string; messageId: string }> }) {
  const { roundRobinId, messageId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [message, roundRobin] = await Promise.all([
    prisma.roundRobinMessage.findUnique({ where: { id: messageId } }),
    prisma.roundRobin.findUnique({ where: { id: roundRobinId }, select: { createdById: true } }),
  ]);
  if (!message || message.roundRobinId !== roundRobinId || !roundRobin) return NextResponse.json({ error: "Message not found." }, { status: 404 });
  if (message.authorId !== user.id && roundRobin.createdById !== user.id) return NextResponse.json({ error: "You can only delete your own messages." }, { status: 403 });
  await prisma.roundRobinMessage.delete({ where: { id: messageId } });
  return NextResponse.json({ ok: true });
}
