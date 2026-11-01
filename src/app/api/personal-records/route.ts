import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadPersonalRecords } from "@/lib/load-personal-records";

// A player's personal records (?userId=, defaults to the signed-in player). The matches behind
// each record are for signed-in viewers only.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = new URL(request.url).searchParams.get("userId") || user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await loadPersonalRecords(userId, user?.id ?? null));
}
