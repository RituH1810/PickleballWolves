import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";

const SKILL_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const EVENT_TYPES = ["SINGLES", "DOUBLES", "MIXED"];
const TEAM_FORMATION_METHODS = ["MANUAL", "AUTO_RANDOM", "AUTO_BALANCED"];
const GROUP_ASSIGNMENT_METHODS = ["MANUAL", "RANDOM", "SEEDED"];
const REGISTRATION_MODES = ["ROSTER", "OPEN"];

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { startDate: "asc" },
    include: { createdBy: { select: { name: true } }, _count: { select: { entrants: true, teams: true } } },
  });
  return NextResponse.json({
    tournaments: tournaments.map((tournament) => ({
      id: tournament.id,
      name: tournament.name,
      location: tournament.location,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      skillLevel: tournament.skillLevel,
      eventType: tournament.eventType,
      registrationMode: tournament.registrationMode,
      registrationDeadline: tournament.registrationDeadline,
      status: tournament.status,
      organizerName: tournament.createdBy.name,
      entrantCount: tournament._count.entrants,
      teamCount: tournament._count.teams,
    })),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a tournament." }, { status: 401 });
  const profile = await ensureProfile(user);
  const body = await request.json();

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const skillLevel = SKILL_LEVELS.includes(body.skillLevel) ? body.skillLevel : null;
  const eventType = EVENT_TYPES.includes(body.eventType) ? body.eventType : null;
  const groupCount = Number(body.groupCount);
  const startDate = new Date(body.startDate);

  if (!name || !location) return NextResponse.json({ error: "Enter a tournament name and location." }, { status: 400 });
  if (!skillLevel) return NextResponse.json({ error: "Choose a skill level." }, { status: 400 });
  if (!eventType) return NextResponse.json({ error: "Choose an event type." }, { status: 400 });
  if (Number.isNaN(startDate.getTime())) return NextResponse.json({ error: "Enter a valid start date." }, { status: 400 });
  if (!Number.isInteger(groupCount) || groupCount < 1) return NextResponse.json({ error: "Enter at least 1 group." }, { status: 400 });

  let endDate: Date | null = null;
  if (typeof body.endDate === "string" && body.endDate) {
    endDate = new Date(body.endDate);
    if (Number.isNaN(endDate.getTime())) return NextResponse.json({ error: "Enter a valid end date." }, { status: 400 });
  }
  let registrationDeadline: Date | null = null;
  if (typeof body.registrationDeadline === "string" && body.registrationDeadline) {
    registrationDeadline = new Date(body.registrationDeadline);
    if (Number.isNaN(registrationDeadline.getTime())) return NextResponse.json({ error: "Enter a valid registration deadline." }, { status: 400 });
  }

  const registrationMode = REGISTRATION_MODES.includes(body.registrationMode) ? body.registrationMode : "ROSTER";
  if (registrationMode === "OPEN" && !registrationDeadline) return NextResponse.json({ error: "Open registration needs a deadline." }, { status: 400 });

  const tournament = await prisma.tournament.create({
    data: {
      createdById: profile.id,
      name,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      location,
      courtCount: Number.isInteger(Number(body.courtCount)) && Number(body.courtCount) > 0 ? Number(body.courtCount) : 2,
      startDate,
      endDate,
      skillLevel,
      eventType,
      groupCount,
      teamFormationMethod: TEAM_FORMATION_METHODS.includes(body.teamFormationMethod) ? body.teamFormationMethod : "AUTO_RANDOM",
      groupAssignmentMethod: GROUP_ASSIGNMENT_METHODS.includes(body.groupAssignmentMethod) ? body.groupAssignmentMethod : "RANDOM",
      registrationMode,
      registrationDeadline,
      pointsToWin: [11, 15, 21].includes(Number(body.pointsToWin)) ? Number(body.pointsToWin) : 11,
      winBy: Number(body.winBy) === 2 ? 2 : 1,
      status: registrationMode === "OPEN" ? "REGISTRATION_OPEN" : "DRAFT",
    },
  });
  return NextResponse.json({ tournament }, { status: 201 });
}
