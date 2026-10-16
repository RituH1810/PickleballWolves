import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { canUseRoundRobinChat } from "@/lib/round-robin-access";
import { CHAT_MESSAGE_MAX as MESSAGE_MAX } from "@/lib/chat";



async function currentUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// The game chat, oldest first (the last 100 messages).
export async function GET(_request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = await context.params;
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await canUseRoundRobinChat(roundRobinId, userId);
  if (!access) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });

  const messages = (await prisma.roundRobinMessage.findMany({ where: { roundRobinId }, orderBy: { createdAt: "desc" }, take: 100 })).reverse();
  const authors = await prisma.user.findMany({ where: { id: { in: [...new Set(messages.map((message) => message.authorId))] } }, select: { id: true, name: true, photoUrl: true } });
  const authorById = new Map(authors.map((author) => [author.id, author]));
  return NextResponse.json({
    messages: messages.map((message) => ({ id: message.id, body: message.body, createdAt: message.createdAt, author: authorById.get(message.authorId) ?? { id: message.authorId, name: "Former player", photoUrl: null }, isMine: message.authorId === userId, canDelete: message.authorId === userId || access.isOrganizer })),
  });
}

// Posts a message and tells everyone in the game (except the author).
export async function POST(request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = await context.params;
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to post." }, { status: 401 });
  const access = await canUseRoundRobinChat(roundRobinId, userId);
  if (!access) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });

  const payload = await request.json().catch(() => null);
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";
  if (!body) return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  if (body.length > MESSAGE_MAX) return NextResponse.json({ error: `Keep it under ${MESSAGE_MAX} characters.` }, { status: 400 });

  const [message, author] = await Promise.all([
    prisma.roundRobinMessage.create({ data: { roundRobinId, authorId: userId, body } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, photoUrl: true } }),
  ]);
  const firstName = author?.name.split(" ")[0] ?? "Someone";
  await Promise.all([...access.participantIds].filter((id) => id !== userId).map((id) => notify(id, "gameChat", "GAME_CHAT", `${firstName} · ${access.roundRobin.name}`, body, `/round-robin/${roundRobinId}#chat`)));
  return NextResponse.json({ message: { id: message.id, body: message.body, createdAt: message.createdAt, author: author ?? { id: userId, name: "You", photoUrl: null }, isMine: true, canDelete: true } }, { status: 201 });
}
