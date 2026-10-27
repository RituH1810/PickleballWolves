import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { canUseRoundRobinChat } from "@/lib/round-robin-access";
import { isReactionEmoji, isReactionTarget, reactionGroupId, summarizeReactions, type ReactionTarget } from "@/lib/reactions";

const TARGET_ID_MAX = 400;

// Who can see and react: a round robin's players and group members (like its chat), or the group's
// active members for group results.
async function canReact(targetType: ReactionTarget, targetId: string, userId: string) {
  if (targetType === "ROUND_ROBIN") return Boolean(await canUseRoundRobinChat(targetId, userId));
  const groupId = reactionGroupId(targetType, targetId);
  if (!groupId) return false;
  const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId } }, select: { status: true } });
  return membership?.status === MembershipStatus.ACTIVE;
}

async function summary(targetType: ReactionTarget, targetId: string, viewerId: string) {
  const rows = await prisma.reaction.findMany({ where: { targetType, targetId }, select: { userId: true, emoji: true, createdAt: true } });
  const people = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.userId))] } }, select: { id: true, name: true } });
  return summarizeReactions(rows, new Map(people.map((person) => [person.id, person.name])), viewerId);
}

async function authorize(targetType: unknown, targetId: unknown) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in to react." }, { status: 401 }) };
  if (!isReactionTarget(targetType) || typeof targetId !== "string" || !targetId || targetId.length > TARGET_ID_MAX) return { error: NextResponse.json({ error: "Unknown result." }, { status: 400 }) };
  if (!(await canReact(targetType, targetId, user.id))) return { error: NextResponse.json({ error: "You can't react to this." }, { status: 403 }) };
  return { userId: user.id, targetType, targetId };
}

// The reactions on one result (?type=&id=).
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const auth = await authorize(params.get("type"), params.get("id"));
  if ("error" in auth) return auth.error;
  return NextResponse.json({ reactions: await summary(auth.targetType, auth.targetId, auth.userId) });
}

// Toggles the signed-in player's emoji on a result and returns the updated reactions.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const auth = await authorize(body?.targetType, body?.targetId);
  if ("error" in auth) return auth.error;
  if (!isReactionEmoji(body.emoji)) return NextResponse.json({ error: "Pick one of the offered reactions." }, { status: 400 });

  const key = { targetType: auth.targetType, targetId: auth.targetId, userId: auth.userId, emoji: body.emoji };
  const removed = await prisma.reaction.deleteMany({ where: key });
  if (!removed.count) await prisma.reaction.upsert({ where: { targetType_targetId_userId_emoji: key }, create: key, update: {} });
  return NextResponse.json({ reactions: await summary(auth.targetType, auth.targetId, auth.userId) });
}
