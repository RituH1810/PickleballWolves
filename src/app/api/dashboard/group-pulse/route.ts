import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadGroupPulse } from "@/lib/load-dashboard-cards";

// Dashboard card for the signed-in player -- Group pulse: newest activity across your groups.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ items: await loadGroupPulse(user.id) });
}
