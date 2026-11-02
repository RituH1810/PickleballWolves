import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { canRunRoundRobin } from "@/lib/round-robin-access";
import { cancelPlayoffs, startPlayoffs } from "@/lib/load-playoffs";

async function authorize(roundRobinId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to run playoffs." }, { status: 401 });
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId }, select: { createdById: true, coHostIds: true, groupId: true } });
  if (!roundRobin) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  if (!(await canRunRoundRobin(roundRobin, user.id))) return NextResponse.json({ error: "Only the organizer or a co-host can run playoffs." }, { status: 403 });
  return null;
}

// Starts optional night-end playoffs from the standings so far ({ size: "FINAL" | "SEMIS" }).
export async function POST(request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = await context.params;
  const denied = await authorize(roundRobinId);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const size = body?.size === "SEMIS" ? "SEMIS" : "FINAL";
  const result = await startPlayoffs(roundRobinId, size);
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}

// Calls off playoffs before any playoff match is scored.
export async function DELETE(_request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = await context.params;
  const denied = await authorize(roundRobinId);
  if (denied) return denied;
  if (!(await cancelPlayoffs(roundRobinId))) return NextResponse.json({ error: "A playoff match has a score already, so playoffs can't be called off." }, { status: 400 });
  return NextResponse.json({ success: true });
}
