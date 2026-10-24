import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadPartners } from "@/lib/load-rivalry";

// A player's partner chemistry: their record with each partner and best partner (?userId=, defaults to the signed-in player).
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = new URL(request.url).searchParams.get("userId") || user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await loadPartners(userId));
}
