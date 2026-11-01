import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadWinStreak } from "@/lib/load-win-streak";

// A player's best and current win streaks (?userId=, defaults to the signed-in player). The matches
// behind the best streak are for signed-in viewers only.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = new URL(request.url).searchParams.get("userId") || user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await loadWinStreak(userId, user?.id ?? null));
}
