import { computeRoundRobinStandings } from "./round-robin-recap";

export type LiveMatch = {
  id: string;
  roundNumber: number | null;
  stage: string | null;
  courtNumber: number | null;
  createdAt: Date;
  players: { userId: string; name: string; side: "A" | "B" }[];
  scores: { gameNumber: number; sideAScore: number; sideBScore: number }[];
};

/**
 * Where a player stands in a round robin that's on now: their place in the standings (ties share),
 * their record so far, the round being played, and their next unscored match -- in the order the
 * night runs: regular rounds, then playoffs, then manual matches as they were created.
 */
export function liveSnapshot(matches: LiveMatch[], userId: string) {
  const regular = matches.filter((match) => !match.stage);
  const standings = computeRoundRobinStandings(regular.filter((match) => match.scores.length));
  const mine = standings.find((entry) => entry.userId === userId) ?? null;
  const place = mine ? standings.findIndex((entry) => entry.wins === mine.wins && entry.differential === mine.differential) + 1 : null;

  const inRounds = matches.filter((match) => match.roundNumber !== null);
  const manual = matches.filter((match) => match.roundNumber === null).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const ordered = [
    ...inRounds.filter((match) => !match.stage).sort((a, b) => a.roundNumber! - b.roundNumber! || (a.courtNumber ?? 0) - (b.courtNumber ?? 0)),
    ...inRounds.filter((match) => match.stage).sort((a, b) => a.roundNumber! - b.roundNumber! || (a.courtNumber ?? 0) - (b.courtNumber ?? 0)),
    ...manual,
  ];
  const label = (match: LiveMatch) => {
    const where = match.stage === "FINAL" ? "Final" : match.stage === "SEMIFINAL" ? "Semifinal" : match.roundNumber !== null ? `Round ${match.roundNumber}` : `Match ${manual.indexOf(match) + 1}`;
    return match.courtNumber ? `${where} · Court ${match.courtNumber}` : where;
  };
  const next = ordered.find((match) => !match.scores.length && match.players.some((player) => player.userId === userId)) ?? null;
  const mySide = next?.players.find((player) => player.userId === userId)?.side;
  const unscoredRounds = regular.filter((match) => match.roundNumber !== null && !match.scores.length).map((match) => match.roundNumber!);

  return {
    place,
    of: standings.length,
    wins: mine?.wins ?? 0,
    losses: mine?.losses ?? 0,
    currentRound: unscoredRounds.length ? Math.min(...unscoredRounds) : null,
    nextMatch: next && {
      label: label(next),
      partners: next.players.filter((player) => player.side === mySide && player.userId !== userId).map((player) => player.name),
      opponents: next.players.filter((player) => player.side !== mySide).map((player) => player.name),
    },
  };
}
