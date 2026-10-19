import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadTopRival } from "@/lib/load-rivalry";

// A player's biggest rival: the opponent they've faced most (?userId=, defaults to the signed-in player).
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = new URL(request.url).searchParams.get("userId") || user.id;
  return NextResponse.json({ rival: await loadTopRival(userId) });
}
