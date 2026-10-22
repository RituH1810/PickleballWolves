import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadRivalry } from "@/lib/load-rivalry";

// Two players' rivalry (?a=&b=; a defaults to the signed-in player). Same visibility as match
// history and public profiles, so signed-out visitors can see it too.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const params = new URL(request.url).searchParams;
  // "me" lets links say "the signed-in player vs X" without knowing their id.
  const a = !params.get("a") || params.get("a") === "me" ? user?.id : params.get("a")!;
  if (!a) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = params.get("b");
  if (!b || a === b) return NextResponse.json({ error: "Pick two different players." }, { status: 400 });
  const rivalry = await loadRivalry(a, b);
  if (!rivalry) return NextResponse.json({ error: "Player not found." }, { status: 404 });
  return NextResponse.json({ rivalry });
}
