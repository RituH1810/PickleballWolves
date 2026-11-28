import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadLiveRoundRobin } from "@/lib/load-dashboard-cards";

// Dashboard card for the signed-in player -- Live now: the round robin they're in tonight.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ live: await loadLiveRoundRobin(user.id) });
}
