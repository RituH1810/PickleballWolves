// Optional night-end playoffs for a round robin: the top of the standings play a final, or
// semifinals and a final. Playoff rounds carry a stage; regular rounds don't.
export type PlayoffStage = "SEMIFINAL" | "FINAL";
export type PlayoffSize = "FINAL" | "SEMIS";
export type PlayoffMatch = { teamA: string[]; teamB: string[] };

/**
 * How many qualify: singles and fixed-partner teams need 2 sides for a final or 4 for semis;
 * rotating doubles pairs the top players up, so 4 players for a final or 8 for semis.
 */
export function playoffSpots(size: PlayoffSize, unit: "player" | "team" | "rotating") {
  const sides = size === "FINAL" ? 2 : 4;
  return unit === "rotating" ? sides * 2 : sides;
}

/**
 * The first playoff round from the night's standings (best first; ties keep standings order).
 * Singles and fixed teams: 1 v 2, or semis 1 v 4 and 2 v 3. Rotating doubles builds balanced
 * pairs from the top seeds: 1+4 v 2+3, or semis 1+8 v 4+5 and 2+7 v 3+6.
 * `teams` (fixed partners) lists each pair; a team ranks by its best-placed player.
 * Null when not enough players have played.
 */
export function seedPlayoffs(rankedUserIds: string[], size: PlayoffSize, playFormat: "SINGLES" | "DOUBLES", teams: string[][] | null = null): { stage: PlayoffStage; matches: PlayoffMatch[] } | null {
  const stage: PlayoffStage = size === "FINAL" ? "FINAL" : "SEMIFINAL";
  if (playFormat === "DOUBLES" && teams) {
    const position = (userId: string) => { const index = rankedUserIds.indexOf(userId); return index < 0 ? Infinity : index; };
    const seeded = teams.filter((team) => team.some((userId) => rankedUserIds.includes(userId))).sort((a, b) => Math.min(...a.map(position)) - Math.min(...b.map(position)));
    if (seeded.length < playoffSpots(size, "team")) return null;
    return { stage, matches: size === "FINAL" ? [{ teamA: seeded[0], teamB: seeded[1] }] : [{ teamA: seeded[0], teamB: seeded[3] }, { teamA: seeded[1], teamB: seeded[2] }] };
  }
  if (playFormat === "DOUBLES") {
    const seed = rankedUserIds;
    if (seed.length < playoffSpots(size, "rotating")) return null;
    return { stage, matches: size === "FINAL" ? [{ teamA: [seed[0], seed[3]], teamB: [seed[1], seed[2]] }] : [{ teamA: [seed[0], seed[7]], teamB: [seed[3], seed[4]] }, { teamA: [seed[1], seed[6]], teamB: [seed[2], seed[5]] }] };
  }
  if (rankedUserIds.length < playoffSpots(size, "player")) return null;
  const [a, b, c, d] = rankedUserIds;
  return { stage, matches: size === "FINAL" ? [{ teamA: [a], teamB: [b] }] : [{ teamA: [a], teamB: [d] }, { teamA: [b], teamB: [c] }] };
}

type ScoredMatch = { players: { userId: string; side: "A" | "B" }[]; scores: { sideAScore: number; sideBScore: number }[] };

/** The side that won a playoff match on total points, or null while it's unscored or level. */
export function playoffWinners(match: ScoredMatch): string[] | null {
  if (!match.scores.length) return null;
  const a = match.scores.reduce((total, score) => total + score.sideAScore, 0);
  const b = match.scores.reduce((total, score) => total + score.sideBScore, 0);
  if (a === b) return null;
  return match.players.filter((player) => player.side === (a > b ? "A" : "B")).map((player) => player.userId);
}

/** The final once both semifinals (in court order) have winners: semi 1's winners v semi 2's. */
export function finalFromSemis(semis: ScoredMatch[]): PlayoffMatch | null {
  if (semis.length !== 2) return null;
  const [first, second] = semis.map(playoffWinners);
  return first && second ? { teamA: first, teamB: second } : null;
}
