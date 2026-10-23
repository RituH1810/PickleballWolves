import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadGameWeather } from "@/lib/load-weather";

const MAX_GAMES = 12;

// Forecasts for games: ?roundRobinIds=a,b&eventIds=c. Signed-in players only, since each lookup
// calls the (free, fair-use) weather services.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const ids = (name: string) => (params.get(name) ?? "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, MAX_GAMES);
  return NextResponse.json({ weather: await loadGameWeather(ids("roundRobinIds"), ids("eventIds")) });
}
