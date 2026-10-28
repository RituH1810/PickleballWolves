import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { buildLeaderboard, MIN_MATCHES_FOR_RANKING } from "@/lib/leaderboard";
import { START_RATING } from "@/lib/rating";

// Players pick their own starting rating; once a match has rated them, the rating is earned and only matches move it.
const hasRatedMatches = async (userId: string) => (await prisma.ratingHistory.count({ where: { userId, ladderId: null, matchId: { not: null } } })) > 0;

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only set name on first-ever profile creation; never resync it from auth metadata afterward,
  // or a Google login would silently overwrite a name the user (or an admin) had customized.
  const profile = await prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email ?? "" },
    create: { id: user.id, email: user.email ?? `${user.id}@placeholder.local`, name: user.user_metadata.name ?? user.email?.split("@")[0] ?? "Player", skillRating: START_RATING },
  });
  const matches = await prisma.match.findMany({ where: { status: "COMPLETED", deletedAt: null, players: { some: { userId: user.id } } }, include: { players: true, scores: true } });
  const wins = matches.filter((match) => { const player = match.players.find((matchPlayer) => matchPlayer.userId === user.id); return match.scores.reduce((total, score) => total + (player?.side === "A" ? score.sideAScore - score.sideBScore : score.sideBScore - score.sideAScore), 0) > 0; }).length;

  // Same ranking as the leaderboard (and public profiles): win %, then point differential, among
  // players with enough matches to qualify. Unqualified players have no rank yet.
  const entry = (await buildLeaderboard()).find((row) => row.id === user.id);
  const rank = entry?.rank ?? null;
  const matchesToQualify = entry ? 0 : Math.max(0, MIN_MATCHES_FOR_RANKING - matches.length);

  return NextResponse.json({ profile: { ...profile, skillRating: profile.skillRating.toString(), ratingLocked: await hasRatedMatches(user.id), record: `${wins} - ${Math.max(0, matches.length - wins)}`, winRate: matches.length ? `${((wins / matches.length) * 100).toFixed(1)}%` : "0.0%", rank, matchesToQualify } });
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const homeCourt = typeof body.homeCourt === "string" ? body.homeCourt.trim() : null;
  const preferredHand = ["LEFT", "RIGHT", "AMBIDEXTROUS"].includes(body.preferredHand) ? body.preferredHand : "RIGHT";
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : undefined;
  const photoUrl = typeof body.photoUrl === "string" ? body.photoUrl.trim() || null : undefined;

  // No rating here: everyone starts at 2.500 and earns it from match results (lib/rating.ts).
  if (!name) return NextResponse.json({ error: "Enter a name." }, { status: 400 });
  if (phone && !/^[+()\-.\s\d]{7,20}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  const profile = await prisma.user.upsert({
    where: { id: user.id },
    update: { name, homeCourt, preferredHand, ...(phone !== undefined ? { phone } : {}), ...(photoUrl !== undefined ? { photoUrl } : {}) },
    create: { id: user.id, email: user.email ?? `${user.id}@placeholder.local`, name, homeCourt, preferredHand, skillRating: START_RATING, phone: phone ?? null, photoUrl: photoUrl ?? null },
  });

  return NextResponse.json({ profile: { ...profile, skillRating: profile.skillRating.toString(), ratingLocked: true } });
}
