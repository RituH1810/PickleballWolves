import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadMyWeek } from "@/lib/load-dashboard-cards";

// Dashboard card for the signed-in player -- Your week: rating change, form and next game.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ week: await loadMyWeek(user.id) });
}
