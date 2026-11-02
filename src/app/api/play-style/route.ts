import { NextResponse } from "next/server";
import { MatchStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { cleanStyle, computeStyleInsights, type PlayStyle } from "@/lib/play-style";

// The PlayStyle table is created by hand in Supabase (prisma/sql/play-style.sql); until it
// exists, styles read as empty and saving reports that it isn't ready, instead of breaking pages.
async function stylesOf(userIds: string[]): Promise<Map<string, PlayStyle> | null> {
  try {
    const rows = await prisma.playStyle.findMany({ where: { userId: { in: userIds } } });
    return new Map(rows.map((row) => [row.userId, row]));
  } catch {
    return null;
  }
}

// A player's style tags (?userId=, defaults to the signed-in player) and their record with
// partners of each style.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = new URL(request.url).searchParams.get("userId") || user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const matches = await prisma.match.findMany({
    where: { status: MatchStatus.COMPLETED, deletedAt: null, scores: { some: {} }, players: { some: { userId } } },
    select: { winnerSide: true, players: { select: { userId: true, side: true } }, scores: { select: { gameNumber: true, sideAScore: true, sideBScore: true } } },
  });
  const ids = [...new Set([userId, ...matches.flatMap((match) => match.players.map((player) => player.userId))])];
  const styles = await stylesOf(ids);
  if (!styles) return NextResponse.json({ ready: false, style: null, insights: [] });
  const mine = styles.get(userId);
  return NextResponse.json({ ready: true, style: mine ? { side: mine.side ?? null, shots: mine.shots ?? null, pace: mine.pace ?? null } : null, insights: computeStyleInsights(matches, userId, styles) });
}

// Sets the signed-in player's own style tags.
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to set your playing style." }, { status: 401 });
  const style = cleanStyle(await request.json().catch(() => ({})));
  try {
    await prisma.playStyle.upsert({ where: { userId: user.id }, create: { userId: user.id, ...style }, update: style });
  } catch {
    return NextResponse.json({ error: "Playing styles aren't switched on yet." }, { status: 503 });
  }
  return NextResponse.json({ style });
}
