import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email ?? "", name: user.user_metadata.name ?? user.email?.split("@")[0] ?? "Player" },
    create: { id: user.id, email: user.email ?? `${user.id}@placeholder.local`, name: user.user_metadata.name ?? user.email?.split("@")[0] ?? "Player", skillRating: 2.0 },
  });
  const matches = await prisma.match.findMany({ where: { status: "COMPLETED", deletedAt: null, players: { some: { userId: user.id } } }, include: { players: true, scores: true } });
  const wins = matches.filter((match) => { const player = match.players.find((matchPlayer) => matchPlayer.userId === user.id); return match.scores.reduce((total, score) => total + (player?.side === "A" ? score.sideAScore - score.sideBScore : score.sideBScore - score.sideAScore), 0) > 0; }).length;
  const rank = (await prisma.user.count({ where: { skillRating: { gt: profile.skillRating } } })) + 1;
  return NextResponse.json({ profile: { ...profile, skillRating: profile.skillRating.toString(), record: `${wins} - ${Math.max(0, matches.length - wins)}`, winRate: matches.length ? `${((wins / matches.length) * 100).toFixed(1)}%` : "0.0%", rank } });
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const homeCourt = typeof body.homeCourt === "string" ? body.homeCourt.trim() : null;
  const preferredHand = ["LEFT", "RIGHT", "AMBIDEXTROUS"].includes(body.preferredHand) ? body.preferredHand : "RIGHT";
  const skillRating = Number(body.skillRating);

  if (!name || !Number.isFinite(skillRating) || skillRating < 2 || skillRating > 6) {
    return NextResponse.json({ error: "Enter a name and a rating between 2.0 and 6.0." }, { status: 400 });
  }

  const profile = await prisma.user.upsert({
    where: { id: user.id },
    update: { name, homeCourt, preferredHand, skillRating },
    create: { id: user.id, email: user.email ?? `${user.id}@placeholder.local`, name, homeCourt, preferredHand, skillRating },
  });

  return NextResponse.json({ profile: { ...profile, skillRating: profile.skillRating.toString() } });
}
