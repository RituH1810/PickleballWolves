import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canUseRoundRobinChat } from "@/lib/round-robin-access";
import { castGoodWolfVote, loadGoodWolf } from "@/lib/load-good-wolf";

// The anonymous Good Wolf vote for an ended round robin. Visible to whoever can see its chat
// (players and group members); only its players can vote.
export async function GET(_request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to see the Good Wolf vote." }, { status: 401 });
  if (!(await canUseRoundRobinChat(roundRobinId, user.id))) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  return NextResponse.json({ goodWolf: await loadGoodWolf(roundRobinId, user.id) });
}

// Casts or changes the signed-in player's vote ({ nomineeId }).
export async function POST(request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const { roundRobinId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to vote." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.nomineeId !== "string") return NextResponse.json({ error: "Pick a player." }, { status: 400 });
  const error = await castGoodWolfVote(roundRobinId, user.id, body.nomineeId);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ goodWolf: await loadGoodWolf(roundRobinId, user.id) });
}
