import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { canRunRoundRobin } from "@/lib/round-robin-access";
import { recomputeAllRatings } from "@/lib/recompute-ratings";

export async function DELETE(_request: Request, context: { params: Promise<{ matchId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete this match." }, { status: 401 });
  const { matchId } = await context.params;
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { roundRobin: { select: { id: true, createdById: true, coHostIds: true, groupId: true } }, tournamentGroup: { select: { tournament: { select: { createdById: true } } } }, leagueMatch: { select: { division: { select: { season: { select: { league: { select: { createdById: true } } } } } } } } } });
  if (!match || match.deletedAt) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (!match.roundRobin && !match.tournamentGroup && !match.leagueMatch) return NextResponse.json({ error: "This match isn't part of a round robin, tournament, or league." }, { status: 400 });

  let canManage = false;
  if (match.roundRobin) {
    // Same permission model as entering a score: the organizer can always manage matches, and
    // so can any member who's joined the round robin -- group and non-group alike. Deleting is
    // more destructive than scoring, so unlike scoring this doesn't extend to mere match
    // participants who haven't actually joined.
    canManage = await canRunRoundRobin(match.roundRobin, user.id);
    if (!canManage) {
      const myRsvp = await prisma.roundRobinRSVP.findUnique({ where: { roundRobinId_userId: { roundRobinId: match.roundRobin.id, userId: user.id } } });
      canManage = myRsvp?.status === "JOINED";
    }
  } else if (match.tournamentGroup) {
    // Deleting a match is more destructive than scoring it, so tournaments keep this
    // organizer-only rather than extending it to playing teams.
    canManage = match.tournamentGroup.tournament.createdById === user.id;
  } else if (match.leagueMatch) {
    // Same reasoning as tournaments: organizer-only for deletion.
    canManage = match.leagueMatch.division.season.league.createdById === user.id;
  }
  if (!canManage) return NextResponse.json({ error: "Only the organizer or a joined member can delete matches." }, { status: 403 });

  await prisma.match.update({ where: { id: matchId }, data: { deletedAt: new Date() } });
  // A deleted match no longer counts toward anyone's rating.
  await recomputeAllRatings();
  return NextResponse.json({ success: true });
}
