import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";

export async function GET() {
  const leagues = await prisma.league.findMany({ orderBy: { createdAt: "desc" } });
  const seasons = await prisma.season.findMany({ orderBy: { startDate: "desc" } });
  return NextResponse.json({ leagues, seasons });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a league." }, { status: 401 });
  const profile = await ensureProfile(user);
  const body = await request.json();
  if (!body.name || !body.seasonName) return NextResponse.json({ error: "Enter a league and season name." }, { status: 400 });
  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);
  const league = await prisma.league.create({ data: { name: body.name.trim(), description: body.description?.trim(), format: body.format || "DOUBLES", createdById: profile.id } });
  const season = await prisma.season.create({ data: { leagueId: league.id, name: body.seasonName.trim(), startDate, endDate, registrationOpensAt: new Date(), registrationClosesAt: startDate, status: "UPCOMING", playoffsEnabled: Boolean(body.playoffsEnabled) } });
  return NextResponse.json({ league, season }, { status: 201 });
}
