import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

function shuffle<T>(items: T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

type MatchInput = { roundRobinId: string; courtNumber: number; scheduledAt: Date; players: { create: { userId: string; side: "A" | "B" }[] } };
type RoundInput = { roundNumber: number; matches: MatchInput[] };

export async function POST(request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to generate a schedule." }, { status: 401 });
  const { roundRobinId } = await context.params;
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId } });
  if (!roundRobin) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });

  // The organizer can always start it; for group round robins, any active group member can
  // start it too, so the group isn't blocked on the organizer being available.
  let canGenerate = roundRobin.createdById === user.id;
  if (!canGenerate && roundRobin.groupId) {
    const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId: roundRobin.groupId, userId: user.id } } });
    canGenerate = membership?.status === MembershipStatus.ACTIVE;
  }
  if (!canGenerate) return NextResponse.json({ error: "Only the organizer or a group member can start this round robin." }, { status: 403 });

  const existingScoreCount = await prisma.gameScore.count({ where: { match: { roundRobinId } } });
  if (existingScoreCount > 0) return NextResponse.json({ error: "Matches already have scores entered; the schedule can no longer be regenerated." }, { status: 400 });
  const body = await request.json();
  const explicitTeams: string[][] | null = Array.isArray(body.teams)
    ? body.teams.filter((team: unknown): team is string[] => Array.isArray(team) && team.length === 2 && team.every((id) => typeof id === "string"))
    : null;
  const hasExplicitSelection = Boolean(explicitTeams) || Array.isArray(body.playerIds);
  let playerIds: string[] = explicitTeams ? explicitTeams.flat() : (Array.isArray(body.playerIds) ? body.playerIds.filter((id: unknown): id is string => typeof id === "string") : []);

  if (roundRobin.groupId) {
    if (hasExplicitSelection) {
      // The organizer picked these players/teams directly (e.g. from the edit page's full
      // roster) -- trust that choice rather than requiring each one to have separately RSVP'd
      // JOINED. Still confirm they're actually in the group, not just any platform user.
      const members = await prisma.membership.findMany({ where: { groupId: roundRobin.groupId, status: "ACTIVE" }, select: { userId: true } });
      const memberIds = new Set(members.map((membership) => membership.userId));
      if (playerIds.some((id) => !memberIds.has(id))) return NextResponse.json({ error: "Every selected player must be a member of the group." }, { status: 400 });
    } else {
      // No explicit selection was sent (the room page's "Generate matches" button) -- fall back
      // to whoever has self-RSVP'd JOINED.
      const joined = await prisma.roundRobinRSVP.findMany({ where: { roundRobinId, status: "JOINED" }, select: { userId: true } });
      playerIds = joined.map((rsvp) => rsvp.userId);
    }
  }

  if (playerIds.length < 4) return NextResponse.json({ error: roundRobin.groupId ? "At least four group members need to join before you can generate the schedule." : "Add at least four players." }, { status: 400 });
  if (explicitTeams && new Set(playerIds).size !== playerIds.length) return NextResponse.json({ error: "Each player can only be on one team." }, { status: 400 });

  const isDoubles = roundRobin.playFormat !== "SINGLES";
  const fixedPartners = roundRobin.partnerFormat === "FIXED";
  if (fixedPartners && isDoubles && !explicitTeams) return NextResponse.json({ error: "Pair up your fixed teams before generating." }, { status: 400 });
  const rounds: RoundInput[] = [];
  const scheduledAt = roundRobin.scheduledAt ?? new Date();

  if (!isDoubles || fixedPartners) {
    // Stable units for the whole event: individual players (singles), or explicit organizer-chosen teams (fixed doubles/mixed).
    let units: string[][] = explicitTeams ?? playerIds.map((id) => [id]);
    if (units.length % 2) units.push(["BYE"]);
    for (let roundNumber = 1; roundNumber <= roundRobin.roundCount; roundNumber++) {
      const matches: MatchInput[] = [];
      for (let index = 0; index < units.length / 2; index++) {
        const teamA = units[index];
        const teamB = units[units.length - 1 - index];
        if (teamA.includes("BYE") || teamB.includes("BYE")) continue;
        matches.push({ roundRobinId, courtNumber: (index % roundRobin.courtCount) + 1, scheduledAt, players: { create: [...teamA.map((userId) => ({ userId, side: "A" as const })), ...teamB.map((userId) => ({ userId, side: "B" as const }))] } });
      }
      rounds.push({ roundNumber, matches });
      const fixed = units[0];
      const rotating = units.slice(1);
      rotating.unshift(rotating.pop()!);
      units = [fixed, ...rotating];
    }
  } else {
    // Rotating doubles/mixed partners: reshuffle players into fresh teams every round.
    for (let roundNumber = 1; roundNumber <= roundRobin.roundCount; roundNumber++) {
      const shuffled = shuffle(playerIds);
      if (shuffled.length % 2) shuffled.pop();
      const teams: string[][] = Array.from({ length: Math.floor(shuffled.length / 2) }, (_, i) => [shuffled[i * 2], shuffled[i * 2 + 1]]);
      const matches: MatchInput[] = [];
      for (let index = 0; index < Math.floor(teams.length / 2); index++) {
        const teamA = teams[index * 2];
        const teamB = teams[index * 2 + 1];
        matches.push({ roundRobinId, courtNumber: (index % roundRobin.courtCount) + 1, scheduledAt, players: { create: [...teamA.map((userId) => ({ userId, side: "A" as const })), ...teamB.map((userId) => ({ userId, side: "B" as const }))] } });
      }
      rounds.push({ roundNumber, matches });
    }
  }

  await prisma.$transaction(async (transaction) => {
    // Match.roundRobinId/roundId are onDelete: SetNull, not Cascade, so deleting rounds alone
    // orphans their matches (and match players) instead of removing them -- clean those up first.
    const staleMatches = await transaction.match.findMany({ where: { roundRobinId }, select: { id: true } });
    const staleMatchIds = staleMatches.map((match) => match.id);
    await transaction.matchPlayer.deleteMany({ where: { matchId: { in: staleMatchIds } } });
    await transaction.match.deleteMany({ where: { id: { in: staleMatchIds } } });
    await transaction.round.deleteMany({ where: { roundRobinId } });
    for (const round of rounds) await transaction.round.create({ data: { roundRobinId, roundNumber: round.roundNumber, matches: { create: round.matches } } });
    await transaction.roundRobin.update({ where: { id: roundRobinId }, data: { status: "LIVE" } });
  });
  return NextResponse.json({ rounds: rounds.length, matches: rounds.reduce((total, round) => total + round.matches.length, 0) });
}
