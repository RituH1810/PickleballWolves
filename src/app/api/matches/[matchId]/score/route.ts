import { NextResponse } from "next/server";
import { MatchStatus, Side } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { announceNewAchievements } from "@/lib/announce-achievements";
import { notify } from "@/lib/notifications";
import { canRunRoundRobin } from "@/lib/round-robin-access";
import { recomputeAllRatings } from "@/lib/recompute-ratings";
import { THIRD_PLACE_POSITION, thirdPlaceSlot } from "@/lib/tournament";
import { advancePlayoffs } from "@/lib/load-playoffs";

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to enter scores." }, { status: 401 });
  const { matchId } = await context.params;
  const body = await request.json();
  const sideAScore = Number(body.sideAScore);
  const sideBScore = Number(body.sideBScore);
  if (!Number.isInteger(sideAScore) || !Number.isInteger(sideBScore) || sideAScore < 0 || sideBScore < 0 || sideAScore === sideBScore) return NextResponse.json({ error: "Enter two different non-negative scores." }, { status: 400 });
  const winnerSide = sideAScore > sideBScore ? Side.A : Side.B;
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { players: { include: { user: { select: { name: true } } } }, roundRobin: { select: { createdById: true, coHostIds: true, groupId: true } }, tournamentGroup: { select: { tournament: { select: { createdById: true } } } }, bracketMatch: { select: { id: true, tournamentId: true, round: true, position: true, nextMatchId: true, nextSlot: true } }, leagueMatch: { select: { division: { select: { season: { select: { league: { select: { createdById: true } } } } } } } } } });
  if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (match.roundRobin) {
    // The organizer can always score. So can anyone actually playing in this match (added by
    // the organizer or self-RSVP'd), and any member who's joined the round robin overall --
    // this applies to group and non-group round robins alike.
    let canEnterScore = match.players.some((player) => player.userId === user.id) || await canRunRoundRobin(match.roundRobin, user.id);
    if (!canEnterScore) {
      const myRsvp = await prisma.roundRobinRSVP.findUnique({ where: { roundRobinId_userId: { roundRobinId: match.roundRobinId!, userId: user.id } } });
      canEnterScore = myRsvp?.status === "JOINED";
    }
    if (!canEnterScore) return NextResponse.json({ error: "Only the organizer or a joined member can update scores." }, { status: 403 });
  }
  if (match.tournamentGroup) {
    const isOrganizer = match.tournamentGroup.tournament.createdById === user.id;
    const isPlaying = match.players.some((player) => player.userId === user.id);
    if (!isOrganizer && !isPlaying) return NextResponse.json({ error: "Only the organizer or a player in this match can update the score." }, { status: 403 });
  }
  if (match.bracketMatch) {
    const bracketTournament = await prisma.tournament.findUnique({ where: { id: match.bracketMatch.tournamentId }, select: { createdById: true } });
    const isOrganizer = bracketTournament?.createdById === user.id;
    const isPlaying = match.players.some((player) => player.userId === user.id);
    if (!isOrganizer && !isPlaying) return NextResponse.json({ error: "Only the organizer or a player in this match can update the score." }, { status: 403 });
  }
  if (match.leagueMatch) {
    const isOrganizer = match.leagueMatch.division.season.league.createdById === user.id;
    const isPlaying = match.players.some((player) => player.userId === user.id);
    if (!isOrganizer && !isPlaying) return NextResponse.json({ error: "Only the organizer or a player in this match can update the score." }, { status: 403 });
  }
  if (!match.roundRobin && !match.tournamentGroup && !match.bracketMatch && !match.leagueMatch) {
    // Freestanding matches (e.g. an accepted ladder challenge) have no organizer to fall back
    // to -- only the two people who actually played can report the score.
    const isPlaying = match.players.some((player) => player.userId === user.id);
    if (!isPlaying) return NextResponse.json({ error: "Only a player in this match can update the score." }, { status: 403 });
  }
  const score = await prisma.gameScore.upsert({ where: { matchId_gameNumber: { matchId, gameNumber: Number(body.gameNumber) || 1 } }, update: { sideAScore, sideBScore, enteredById: user.id }, create: { matchId, gameNumber: Number(body.gameNumber) || 1, sideAScore, sideBScore, enteredById: user.id } });
  const wasAlreadyCompleted = match.status === MatchStatus.COMPLETED;
  await prisma.match.update({ where: { id: matchId }, data: { status: MatchStatus.COMPLETED, winnerSide } });
  await prisma.auditLog.create({ data: { actorId: user.id, entityType: "GameScore", entityId: score.id, action: "SCORE_ENTERED", afterData: { matchId, gameNumber: score.gameNumber, sideAScore, sideBScore }, matchId } });

  const enteredByName = match.players.find((player) => player.userId === user.id)?.user.name ?? (await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }))?.name ?? "Someone";
  await Promise.all(match.players.filter((player) => player.userId !== user.id).map((player) => {
    const won = player.side === winnerSide;
    return notify(player.userId, "general", "SCORE_ADDED", "Score added to your match", `${enteredByName} recorded a score of ${sideAScore}-${sideBScore}. You ${won ? "won" : "lost"} this game.`);
  }));

  // Ratings are replayed from the full history on every save, so a corrected score corrects
  // everyone's ratings too (instead of keeping the effect of the first, wrong score).
  const nameById = new Map(match.players.map((player) => [player.userId, player.user.name]));
  const sideById = new Map(match.players.map((player) => [player.userId, player.side]));
  const ratingChanges = (await recomputeAllRatings())
    .filter((change) => change.matchId === matchId)
    .map((change) => ({ ...change, name: nameById.get(change.userId) ?? "Unknown", side: sideById.get(change.userId)! }));
  const average = (side: "A" | "B") => {
    const rows = ratingChanges.filter((change) => change.side === side);
    return rows.length ? Math.round((rows.reduce((total, change) => total + change.ratingBefore, 0) / rows.length) * 1000) / 1000 : null;
  };
  const opponentAvgRating = ratingChanges.length ? { A: average("A")!, B: average("B")! } : null;

  if (!wasAlreadyCompleted) {
    const ladderChallenge = await prisma.challenge.findFirst({ where: { matchId } });
    if (ladderChallenge) {
      // Challenger is always side A, challenged always side B (see the respond route).
      const [challengerPosition, challengedPosition] = await Promise.all([
        prisma.ladderPosition.findUnique({ where: { ladderId_userId: { ladderId: ladderChallenge.ladderId, userId: ladderChallenge.challengerId } } }),
        prisma.ladderPosition.findUnique({ where: { ladderId_userId: { ladderId: ladderChallenge.ladderId, userId: ladderChallenge.challengedId } } }),
      ]);
      if (challengerPosition && challengedPosition) {
        const challengerWon = winnerSide === Side.A;
        const winner = challengerWon ? challengerPosition : challengedPosition;
        const loser = challengerWon ? challengedPosition : challengerPosition;
        await prisma.$transaction([
          prisma.ladderPosition.update({ where: { id: winner.id }, data: { wins: { increment: 1 }, lastActiveAt: new Date() } }),
          prisma.ladderPosition.update({ where: { id: loser.id }, data: { losses: { increment: 1 }, lastActiveAt: new Date() } }),
          // Classic ladder rule: if the lower-ranked player (higher position number) wins, they
          // take the higher rank and the defender drops to the spot they just won.
          ...(winner.position > loser.position ? [
            prisma.ladderPosition.update({ where: { id: winner.id }, data: { position: loser.position } }),
            prisma.ladderPosition.update({ where: { id: loser.id }, data: { position: winner.position } }),
          ] : []),
        ]);
      }
    }
  }

  if (match.bracketMatch && match.tournamentTeamAId && match.tournamentTeamBId) {
    const winningTeamId = winnerSide === Side.A ? match.tournamentTeamAId : match.tournamentTeamBId;
    const losingTeamId = winnerSide === Side.A ? match.tournamentTeamBId : match.tournamentTeamAId;
    const { nextMatchId, nextSlot, tournamentId, round, position } = match.bracketMatch;
    const finalRound = (await prisma.tournamentBracketMatch.aggregate({ where: { tournamentId }, _max: { round: true } }))._max.round ?? round;
    if (nextMatchId && nextSlot) await placeInBracket(nextMatchId, nextSlot, winningTeamId);
    // A semi-final's loser goes to the third-place match, when the bracket has one.
    if (round === finalRound - 1) {
      const thirdPlace = await prisma.tournamentBracketMatch.findUnique({ where: { tournamentId_round_position: { tournamentId, round: finalRound, position: THIRD_PLACE_POSITION } }, select: { id: true } });
      if (thirdPlace) await placeInBracket(thirdPlace.id, thirdPlaceSlot(position), losingTeamId);
    }
    // The tournament is over once every final-round match (the final, and third place if any) is scored.
    if (round === finalRound) {
      const lastMatches = await prisma.tournamentBracketMatch.findMany({ where: { tournamentId, round: finalRound }, select: { match: { select: { scores: { select: { id: true }, take: 1 } } } } });
      if (lastMatches.every((row) => row.match?.scores.length)) await prisma.tournament.update({ where: { id: tournamentId }, data: { status: "COMPLETED" } });
    }
  }

  // A score can complete a badge (first win, a streak, a bagel...) -- tell whoever just earned one.
  // A semifinal result can complete the playoff final's lineup (a no-op outside playoffs).
  if (match.roundRobinId && match.roundId) await advancePlayoffs(match.roundRobinId);
  await announceNewAchievements(match.players.map((player) => player.userId));
  return NextResponse.json({ score, winnerSide, ratingChanges, opponentAvgRating });
}

/** Puts a team into one slot of a bracket match, creating the match once both teams are known. */
async function placeInBracket(bracketMatchId: string, slot: string, teamId: string) {
  const bracketMatch = await prisma.tournamentBracketMatch.update({ where: { id: bracketMatchId }, data: slot === "A" ? { teamAId: teamId } : { teamBId: teamId } });
  if (!bracketMatch.teamAId || !bracketMatch.teamBId || bracketMatch.matchId) return;
  const [teamA, teamB] = await Promise.all([
    prisma.tournamentTeam.findUnique({ where: { id: bracketMatch.teamAId }, include: { members: true } }),
    prisma.tournamentTeam.findUnique({ where: { id: bracketMatch.teamBId }, include: { members: true } }),
  ]);
  const created = await prisma.match.create({
    data: {
      courtNumber: 1,
      tournamentTeamAId: bracketMatch.teamAId,
      tournamentTeamBId: bracketMatch.teamBId,
      players: { create: [...teamA!.members.map((member) => ({ userId: member.userId, side: "A" as const })), ...teamB!.members.map((member) => ({ userId: member.userId, side: "B" as const }))] },
    },
  });
  await prisma.tournamentBracketMatch.update({ where: { id: bracketMatch.id }, data: { matchId: created.id } });
}
