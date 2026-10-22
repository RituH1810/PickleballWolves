import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// One point per scored match, oldest first. Defaults to the signed-in player; ?userId= shows
// someone else's (match history already exposes per-match rating changes).
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = new URL(request.url).searchParams.get("userId") || user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ladderId rows are ladder ratings, a separate scale from the skill rating charted here.
  const history = await prisma.ratingHistory.findMany({ where: { userId, ladderId: null }, orderBy: { createdAt: "asc" }, select: { ratingBefore: true, ratingAfter: true, ratingDelta: true, createdAt: true } });
  return NextResponse.json({
    start: history.length ? Number(history[0].ratingBefore) : null,
    points: history.map((entry) => ({ at: entry.createdAt, rating: Number(entry.ratingAfter), delta: Number(entry.ratingDelta) })),
  });
}
