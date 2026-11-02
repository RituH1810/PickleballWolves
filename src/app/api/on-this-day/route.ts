import { NextResponse } from "next/server";
import { MatchStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { loadTitleTimeline } from "@/lib/load-recap";
import { APP_TIME_ZONE } from "@/lib/app-time";
import { dayKey, onThisDay } from "@/lib/on-this-day";

// The signed-in player's memory from this day in an earlier month, if any.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [matches, titles] = await Promise.all([
    prisma.match.findMany({
      where: { status: MatchStatus.COMPLETED, deletedAt: null, scores: { some: {} }, players: { some: { userId: user.id } } },
      select: { id: true, updatedAt: true, winnerSide: true, roundRobin: { select: { id: true, name: true } }, players: { select: { userId: true, side: true } }, scores: { select: { gameNumber: true, sideAScore: true, sideBScore: true } } },
    }),
    loadTitleTimeline(user.id),
  ]);
  const memory = onThisDay({
    today: dayKey(new Date(), APP_TIME_ZONE),
    timeZone: APP_TIME_ZONE,
    userId: user.id,
    matches: matches.map((match) => ({ ...match, playedAt: match.updatedAt, event: match.roundRobin })),
    titles: titles.map((title) => ({ roundRobinId: title.roundRobinId, name: title.name, endedAt: title.endedAt })),
  });
  return NextResponse.json({ memory });
}
