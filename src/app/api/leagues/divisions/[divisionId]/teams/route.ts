import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { formTeamsBalanced, formTeamsRandom } from "@/lib/tournament";

export async function POST(request: Request, context: { params: Promise<{ divisionId: string }> }) {
  const { divisionId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage teams." }, { status: 401 });
  const division = await prisma.division.findUnique({ where: { id: divisionId }, include: { season: { include: { league: { select: { createdById: true, format: true } } } } } });
  if (!division) return NextResponse.json({ error: "Division not found." }, { status: 404 });
  if (division.season.league.createdById !== user.id) return NextResponse.json({ error: "Only the organizer can manage teams." }, { status: 403 });
  const hasMatches = await prisma.match.count({ where: { leagueDivisionId: divisionId } });
  if (hasMatches > 0) return NextResponse.json({ error: "Teams are locked once the schedule has been generated." }, { status: 400 });

  const isSingles = division.season.league.format === "SINGLES";
  const body = await request.json();
  const method: string = ["MANUAL", "AUTO_RANDOM", "AUTO_BALANCED"].includes(body.method) ? body.method : "AUTO_BALANCED";

  const registrations = await prisma.leagueRegistration.findMany({
    where: { divisionId, status: "REGISTERED" },
    include: { user: { select: { id: true, name: true, skillRating: true } } },
  });
  if (isSingles && registrations.length < 2) return NextResponse.json({ error: "Need at least 2 registered players for singles." }, { status: 400 });
  if (!isSingles && registrations.length < 4) return NextResponse.json({ error: "Need at least 4 registered players to form teams." }, { status: 400 });

  let pairs: [string, string][] = [];
  let unpairedIds: string[] = [];
  const singlesIds = isSingles ? registrations.map((registration) => registration.userId) : [];

  if (!isSingles) {
    if (method === "MANUAL") {
      const rawPairs: unknown = body.pairs;
      if (!Array.isArray(rawPairs)) return NextResponse.json({ error: "Provide the pairs you've picked." }, { status: 400 });
      const registeredIds = new Set(registrations.map((registration) => registration.userId));
      const seen = new Set<string>();
      for (const pair of rawPairs) {
        if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== "string" || typeof pair[1] !== "string") return NextResponse.json({ error: "Each team needs exactly 2 players." }, { status: 400 });
        const [a, b] = pair;
        if (!registeredIds.has(a) || !registeredIds.has(b)) return NextResponse.json({ error: "Every paired player must be registered." }, { status: 400 });
        if (a === b || seen.has(a) || seen.has(b)) return NextResponse.json({ error: "Each player can only be on one team." }, { status: 400 });
        seen.add(a);
        seen.add(b);
        pairs.push([a, b]);
      }
      unpairedIds = registrations.map((registration) => registration.userId).filter((id) => !seen.has(id));
    } else if (method === "AUTO_BALANCED") {
      const result = formTeamsBalanced(registrations.map((registration) => ({ userId: registration.userId, skillRating: Number(registration.user.skillRating) })));
      pairs = result.teams;
      unpairedIds = result.unpaired.map((entrant) => entrant.userId);
    } else {
      const result = formTeamsRandom(registrations.map((registration) => registration.userId));
      pairs = result.teams;
      unpairedIds = result.unpaired;
    }
  }

  await prisma.$transaction(async (transaction) => {
    const existingTeams = await transaction.leagueTeam.findMany({ where: { divisionId }, select: { id: true } });
    await transaction.leagueTeamMember.deleteMany({ where: { teamId: { in: existingTeams.map((team) => team.id) } } });
    await transaction.leagueTeam.deleteMany({ where: { divisionId } });

    for (const userId of singlesIds) {
      await transaction.leagueTeam.create({ data: { divisionId, members: { create: [{ userId }] } } });
    }
    for (const [a, b] of pairs) {
      await transaction.leagueTeam.create({ data: { divisionId, members: { create: [{ userId: a }, { userId: b }] } } });
    }
  });

  return NextResponse.json({ teamsFormed: pairs.length + singlesIds.length, unpairedCount: unpairedIds.length, unpairedIds });
}
