import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadRecentPersonalRecaps } from "@/lib/load-recap";

// The signed-in player's personal recaps from round robins that ended in the last day.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ recaps: await loadRecentPersonalRecaps(user.id) });
}
