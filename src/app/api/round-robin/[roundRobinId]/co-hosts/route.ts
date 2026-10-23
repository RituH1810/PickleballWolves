import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { canRunRoundRobin } from "@/lib/round-robin-access";

// Co-hosts are picked by the organizer (or a group organizer) -- not by other co-hosts.
async function managedRoundRobin(request: Request, roundRobinId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in to manage co-hosts." }, { status: 401 }) };
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId }, select: { id: true, name: true, createdById: true, coHostIds: true, groupId: true } });
  if (!roundRobin) return { error: NextResponse.json({ error: "Round robin not found." }, { status: 404 }) };
  if (!(await canRunRoundRobin({ ...roundRobin, coHostIds: [] }, user.id))) return { error: NextResponse.json({ error: "Only the organizer can choose co-hosts." }, { status: 403 }) };
  const userId = request.method === "DELETE" ? new URL(request.url).searchParams.get("userId") : (await request.json().catch(() => null))?.userId;
  if (typeof userId !== "string" || !userId) return { error: NextResponse.json({ error: "Pick a player." }, { status: 400 }) };
  return { roundRobin, userId };
}

export async function POST(request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = await context.params;
  const access = await managedRoundRobin(request, roundRobinId);
  if ("error" in access) return access.error;
  const { roundRobin, userId } = access;
  if (userId === roundRobin.createdById) return NextResponse.json({ error: "The organizer can already run this game." }, { status: 400 });
  const player = await prisma.user.findUnique({ where: { id: userId }, select: { isGuest: true } });
  if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });
  if (player.isGuest) return NextResponse.json({ error: "Guests can't co-host -- they don't have an account." }, { status: 400 });
  if (roundRobin.coHostIds.includes(userId)) return NextResponse.json({ coHostIds: roundRobin.coHostIds });

  const updated = await prisma.roundRobin.update({ where: { id: roundRobinId }, data: { coHostIds: { push: userId } }, select: { coHostIds: true } });
  await notify(userId, "general", "CO_HOST_ADDED", `You're co-hosting ${roundRobin.name}`, "You can add players, run rounds, enter scores, and end the round robin.", `/round-robin/${roundRobinId}`);
  return NextResponse.json({ coHostIds: updated.coHostIds });
}

export async function DELETE(request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = await context.params;
  const access = await managedRoundRobin(request, roundRobinId);
  if ("error" in access) return access.error;
  const coHostIds = access.roundRobin.coHostIds.filter((id) => id !== access.userId);
  await prisma.roundRobin.update({ where: { id: roundRobinId }, data: { coHostIds: { set: coHostIds } } });
  return NextResponse.json({ coHostIds });
}
