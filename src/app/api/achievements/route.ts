import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadAchievements } from "@/lib/load-achievements";

// Defaults to the signed-in player; ?userId= shows someone else's badges (same data the
// leaderboards and match history already expose).
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = new URL(request.url).searchParams.get("userId") || user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const achievements = await loadAchievements(userId);
  return NextResponse.json({ achievements, earned: achievements.filter((achievement) => achievement.unlocked).length, total: achievements.length });
}
