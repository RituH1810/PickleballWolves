import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { formMixedTeamsBalanced, formMixedTeamsRandom, formTeamsBalanced, formTeamsRandom, validateMixedPair } from "@/lib/tournament";

async function getManagedTournament(tournamentId: string, userId: string) {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return { error: NextResponse.json({ error: "Tournament not found." }, { status: 404 }) } as const;
  if (tournament.createdById !== userId) return { error: NextResponse.json({ error: "Only the organizer can manage teams." }, { status: 403 }) } as const;
  if (tournament.status === "LIVE" || tournament.status === "COMPLETED") return { error: NextResponse.json({ error: "Teams are locked once the tournament has started." }, { status: 400 }) } as const;
  return { tournament } as const;
}

export async function POST(request: Request, context: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage teams." }, { status: 401 });
  const managed = await getManagedTournament(tournamentId, user.id);
  if ("error" in managed) return managed.error;
  const { tournament } = managed;

  const body = await request.json();
  const method: string = ["MANUAL", "AUTO_RANDOM", "AUTO_BALANCED"].includes(body.method) ? body.method : tournament.teamFormationMethod;

  const entrants = await prisma.tournamentEntrant.findMany({
    where: { tournamentId, status: "REGISTERED" },
    include: { user: { select: { id: true, name: true, skillRating: true, gender: true } } },
  });
  if (tournament.eventType === "SINGLES" && entrants.length < 2) return NextResponse.json({ error: "Need at least 2 registered players for singles." }, { status: 400 });
  if (tournament.eventType !== "SINGLES" && entrants.length < 4) return NextResponse.json({ error: "Need at least 4 registered players to form teams." }, { status: 400 });

  let pairs: [string, string][] = [];
  let unpairedIds: string[] = [];

  if (tournament.eventType === "SINGLES") {
    // Every entrant is their own team; nothing to pair.
  } else if (method === "MANUAL") {
    const rawPairs: unknown = body.pairs;
    if (!Array.isArray(rawPairs)) return NextResponse.json({ error: "Provide the pairs you've picked." }, { status: 400 });
    const entrantIds = new Set(entrants.map((entrant) => entrant.userId));
    const seen = new Set<string>();
    for (const pair of rawPairs) {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== "string" || typeof pair[1] !== "string") return NextResponse.json({ error: "Each team needs exactly 2 players." }, { status: 400 });
      const [a, b] = pair;
      if (!entrantIds.has(a) || !entrantIds.has(b)) return NextResponse.json({ error: "Every paired player must be a registered entrant." }, { status: 400 });
      if (a === b || seen.has(a) || seen.has(b)) return NextResponse.json({ error: "Each player can only be on one team." }, { status: 400 });
      seen.add(a);
      seen.add(b);
      if (tournament.eventType === "MIXED") {
        const genderA = entrants.find((entrant) => entrant.userId === a)?.user.gender ?? null;
        const genderB = entrants.find((entrant) => entrant.userId === b)?.user.gender ?? null;
        const validation = validateMixedPair(genderA, genderB);
        if (!validation.valid && !body.override) return NextResponse.json({ error: validation.reason, genderMismatch: true }, { status: 400 });
      }
      pairs.push([a, b]);
    }
    unpairedIds = entrants.map((entrant) => entrant.userId).filter((id) => !seen.has(id));
  } else if (tournament.eventType === "MIXED") {
    const genderEntrants = entrants.map((entrant) => ({ userId: entrant.userId, gender: entrant.user.gender, skillRating: Number(entrant.user.skillRating) }));
    const withoutGender = genderEntrants.filter((entrant) => !entrant.gender || entrant.gender === "UNSPECIFIED");
    if (withoutGender.length > 0 && !body.override) {
      return NextResponse.json({ error: `${withoutGender.length} player(s) need their gender set before auto-pairing mixed doubles.`, genderMismatch: true, missingGenderCount: withoutGender.length }, { status: 400 });
    }
    const result = method === "AUTO_BALANCED" ? formMixedTeamsBalanced(genderEntrants) : formMixedTeamsRandom(genderEntrants);
    pairs = result.teams;
    unpairedIds = result.unpaired.map((entrant) => entrant.userId);
  } else if (method === "AUTO_BALANCED") {
    const result = formTeamsBalanced(entrants.map((entrant) => ({ userId: entrant.userId, skillRating: Number(entrant.user.skillRating) })));
    pairs = result.teams;
    unpairedIds = result.unpaired.map((entrant) => entrant.userId);
  } else {
    const result = formTeamsRandom(entrants.map((entrant) => entrant.userId));
    pairs = result.teams;
    unpairedIds = result.unpaired;
  }

  const singlesIds = tournament.eventType === "SINGLES" ? entrants.map((entrant) => entrant.userId) : [];

  await prisma.$transaction(async (transaction) => {
    const existingTeams = await transaction.tournamentTeam.findMany({ where: { tournamentId }, select: { id: true } });
    await transaction.tournamentTeamMember.deleteMany({ where: { teamId: { in: existingTeams.map((team) => team.id) } } });
    await transaction.tournamentTeam.deleteMany({ where: { tournamentId } });

    for (const userId of singlesIds) {
      await transaction.tournamentTeam.create({ data: { tournamentId, members: { create: [{ userId }] } } });
    }
    for (const [a, b] of pairs) {
      await transaction.tournamentTeam.create({ data: { tournamentId, members: { create: [{ userId: a }, { userId: b }] } } });
    }
  });

  return NextResponse.json({ teamsFormed: pairs.length + singlesIds.length, unpairedCount: unpairedIds.length, unpairedIds });
}
