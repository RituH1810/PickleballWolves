import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadDailyTip } from "@/lib/load-daily-tip";

// The signed-in player's tip for today (same all day; changes tomorrow).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await loadDailyTip(user.id));
}
