import { prisma } from "@/lib/prisma";
import { computeRoundRobinStandings } from "@/lib/round-robin-recap";
import { finalFromSemis, seedPlayoffs, type PlayoffSize } from "@/lib/playoffs";

/**
 * Starts a round robin's playoffs from its standings so far: a new round, after the regular ones,
 * holding the final or both semifinals. Returns an error message instead when it can't.
 */
export async function startPlayoffs(roundRobinId: string, size: PlayoffSize): Promise<{ error: string } | { stage: string; matches: number }> {
  const roundRobin = await prisma.roundRobin.findUnique({
    where: { id: roundRobinId },
    select: { status: true, playFormat: true, partnerFormat: true, scheduledAt: true, rounds: { select: { roundNumber: true, stage: true } }, matches: { where: { deletedAt: null }, select: { id: true, round: { select: { stage: true } }, players: { select: { userId: true, side: true, user: { select: { name: true } } } }, scores: { select: { gameNumber: true, sideAScore: true, sideBScore: true } } } } },
  });
  if (!roundRobin) return { error: "Round robin not found." };
  if (roundRobin.status === "COMPLETED") return { error: "This round robin has ended." };
  if (roundRobin.rounds.some((round) => round.stage)) return { error: "Playoffs have already started." };

  const regular = roundRobin.matches.filter((match) => !match.round?.stage && match.scores.length);
  const standings = computeRoundRobinStandings(regular.map((match) => ({ id: match.id, players: match.players.map((player) => ({ userId: player.userId, name: player.user.name, side: player.side })), scores: match.scores })));
  const playFormat = roundRobin.playFormat === "SINGLES" ? "SINGLES" : "DOUBLES";
  // Fixed partners stay together: each pair, as they played the regular rounds.
  const teams = playFormat === "DOUBLES" && roundRobin.partnerFormat === "FIXED"
    ? [...new Map(regular.flatMap((match) => (["A", "B"] as const).map((side) => match.players.filter((player) => player.side === side).map((player) => player.userId).sort())).filter((team) => team.length === 2).map((team) => [team.join(":"), team])).values()]
    : null;
  const seeded = seedPlayoffs(standings.map((entry) => entry.userId), size, playFormat, teams);
  if (!seeded) return { error: size === "FINAL" ? "Not enough players have played yet for a final." : "Not enough players have played yet for semifinals -- try a final instead." };

  const roundNumber = Math.max(0, ...roundRobin.rounds.map((round) => round.roundNumber)) + 1;
  const scheduledAt = roundRobin.scheduledAt ?? new Date();
  await prisma.round.create({
    data: {
      roundRobinId,
      roundNumber,
      stage: seeded.stage,
      matches: { create: seeded.matches.map((match, index) => ({ roundRobinId, courtNumber: index + 1, scheduledAt, players: { create: [...match.teamA.map((userId) => ({ userId, side: "A" as const })), ...match.teamB.map((userId) => ({ userId, side: "B" as const }))] } })) },
    },
  });
  return { stage: seeded.stage, matches: seeded.matches.length };
}

/**
 * After a semifinal score is saved: once both semifinals have winners, creates the final -- or,
 * if a corrected semifinal changes who goes through and the final isn't scored yet, swaps them in.
 */
export async function advancePlayoffs(roundRobinId: string) {
  const rounds = await prisma.round.findMany({ where: { roundRobinId, stage: { not: null } }, select: { id: true, roundNumber: true, stage: true, matches: { where: { deletedAt: null }, orderBy: { courtNumber: "asc" }, select: { id: true, players: { select: { userId: true, side: true } }, scores: { select: { sideAScore: true, sideBScore: true } } } } } });
  const semis = rounds.find((round) => round.stage === "SEMIFINAL");
  if (!semis) return;
  const final = finalFromSemis(semis.matches);
  if (!final) return;
  const players = { create: [...final.teamA.map((userId) => ({ userId, side: "A" as const })), ...final.teamB.map((userId) => ({ userId, side: "B" as const }))] };
  const finalRound = rounds.find((round) => round.stage === "FINAL");
  if (!finalRound) {
    const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId }, select: { scheduledAt: true } });
    await prisma.round.create({ data: { roundRobinId, roundNumber: semis.roundNumber + 1, stage: "FINAL", matches: { create: [{ roundRobinId, courtNumber: 1, scheduledAt: roundRobin?.scheduledAt ?? new Date(), players }] } } });
    return;
  }
  const finalMatch = finalRound.matches[0];
  if (!finalMatch || finalMatch.scores.length) return;
  const current = finalMatch.players.map((player) => `${player.side}:${player.userId}`).sort().join(",");
  const wanted = players.create.map((player) => `${player.side}:${player.userId}`).sort().join(",");
  if (current !== wanted) await prisma.$transaction([prisma.matchPlayer.deleteMany({ where: { matchId: finalMatch.id } }), prisma.match.update({ where: { id: finalMatch.id }, data: { players } })]);
}

/** Calls off playoffs that haven't had a score yet. Returns false if any playoff match is already scored. */
export async function cancelPlayoffs(roundRobinId: string) {
  const rounds = await prisma.round.findMany({ where: { roundRobinId, stage: { not: null } }, select: { id: true, matches: { where: { deletedAt: null }, select: { scores: { select: { id: true } } } } } });
  if (rounds.some((round) => round.matches.some((match) => match.scores.length))) return false;
  const roundIds = rounds.map((round) => round.id);
  // Deleting a round only detaches its matches, so remove the (unscored) playoff matches first.
  await prisma.$transaction([prisma.match.deleteMany({ where: { roundId: { in: roundIds } } }), prisma.round.deleteMany({ where: { id: { in: roundIds } } })]);
  return true;
}
