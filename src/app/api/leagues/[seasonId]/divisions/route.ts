import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ seasonId: string }> }) {
  const { seasonId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a division." }, { status: 401 });
  const season = await prisma.season.findUnique({ where: { id: seasonId }, include: { league: { select: { createdById: true } } } });
  if (!season) return NextResponse.json({ error: "Season not found." }, { status: 404 });
  if (season.league.createdById !== user.id) return NextResponse.json({ error: "Only the organizer can create divisions." }, { status: 403 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Enter a division name." }, { status: 400 });
  const minSkillRating = body.minSkillRating !== undefined && body.minSkillRating !== null && body.minSkillRating !== "" ? Number(body.minSkillRating) : null;
  const maxSkillRating = body.maxSkillRating !== undefined && body.maxSkillRating !== null && body.maxSkillRating !== "" ? Number(body.maxSkillRating) : null;
  if (minSkillRating !== null && (!Number.isFinite(minSkillRating) || minSkillRating < 2 || minSkillRating > 6)) return NextResponse.json({ error: "Minimum skill rating must be between 2.0 and 6.0." }, { status: 400 });
  if (maxSkillRating !== null && (!Number.isFinite(maxSkillRating) || maxSkillRating < 2 || maxSkillRating > 6)) return NextResponse.json({ error: "Maximum skill rating must be between 2.0 and 6.0." }, { status: 400 });
  if (minSkillRating !== null && maxSkillRating !== null && minSkillRating > maxSkillRating) return NextResponse.json({ error: "Minimum skill rating can't be higher than the maximum." }, { status: 400 });

  const division = await prisma.division.create({ data: { seasonId, name, minSkillRating, maxSkillRating } });
  return NextResponse.json({ division }, { status: 201 });
}
