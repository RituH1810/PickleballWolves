import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadRivalWatch } from "@/lib/load-dashboard-cards";

// Dashboard card for the signed-in player -- Rival watch: rating neighbor, monthly place and top rivalry.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ lines: await loadRivalWatch(user.id) });
}
