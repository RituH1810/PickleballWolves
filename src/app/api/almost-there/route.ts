import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadAlmostThere } from "@/lib/load-almost-there";

// The signed-in player's nearest goals (rating, matches, streak, badges, monthly boards), closest first.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ goals: await loadAlmostThere(user.id) });
}
