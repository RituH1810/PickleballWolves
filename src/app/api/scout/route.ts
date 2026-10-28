import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadScouting } from "@/lib/load-rivalry";

const MAX_PLAYERS = 8;

// Scouting reports for up to 8 players (?ids=a,b,c): form, current run, clutch verdict, and the
// signed-in player's record against and with each of them.
export async function GET(request: Request) {
  const ids = [...new Set((new URL(request.url).searchParams.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean))].slice(0, MAX_PLAYERS);
  if (!ids.length) return NextResponse.json({ error: "Pick players to scout." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return NextResponse.json({ players: await loadScouting(ids, user?.id ?? null) });
}
