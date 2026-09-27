export type TournamentSkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type Gender = "MALE" | "FEMALE" | "UNSPECIFIED";

// Beginner < 3.5, Intermediate 3.5-3.9..., Advanced >= 4.0.
export function skillLevelForRating(rating: number): TournamentSkillLevel {
  if (rating < 3.5) return "BEGINNER";
  if (rating < 4.0) return "INTERMEDIATE";
  return "ADVANCED";
}

export function shuffle<T>(items: T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export type RatedEntrant = { userId: string; skillRating: number };

/** Pairs entrants two at a time in random order. Odd one out (if any) is returned unpaired. */
export function formTeamsRandom(entrantIds: string[]): { teams: [string, string][]; unpaired: string[] } {
  const shuffled = shuffle(entrantIds);
  const teams: [string, string][] = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) teams.push([shuffled[i], shuffled[i + 1]]);
  const unpaired = shuffled.length % 2 ? [shuffled[shuffled.length - 1]] : [];
  return { teams, unpaired };
}

/**
 * Pairs the strongest entrant with the weakest, second-strongest with second-weakest, etc., so
 * each resulting team's combined rating lands close to the field's overall average instead of
 * stacking strong players together.
 */
export function formTeamsBalanced(entrants: RatedEntrant[]): { teams: [string, string][]; unpaired: RatedEntrant[] } {
  const sorted = [...entrants].sort((a, b) => b.skillRating - a.skillRating);
  const teams: [string, string][] = [];
  let low = 0;
  let high = sorted.length - 1;
  while (low < high) {
    teams.push([sorted[low].userId, sorted[high].userId]);
    low += 1;
    high -= 1;
  }
  const unpaired = low === high ? [sorted[low]] : [];
  return { teams, unpaired };
}

/** A mixed-doubles team must be exactly one MALE and one FEMALE. */
export function validateMixedPair(genderA: Gender | null | undefined, genderB: Gender | null | undefined): { valid: boolean; reason?: string } {
  if (!genderA || !genderB || genderA === "UNSPECIFIED" || genderB === "UNSPECIFIED") {
    return { valid: false, reason: "Both players need their gender set before they can be auto-paired for mixed doubles." };
  }
  if (genderA === genderB) return { valid: false, reason: "A mixed doubles team needs one male and one female player." };
  return { valid: true };
}

/**
 * Pairs a field of entrants for mixed doubles, one male with one female, balancing by rating
 * within each gender pool (same balanced-pairing strategy as formTeamsBalanced). Whoever doesn't
 * have a gender set, or is left over from a gender imbalance, comes back as unpaired for the
 * organizer to sort out manually.
 */
export function formMixedTeamsBalanced(entrants: (RatedEntrant & { gender: Gender | null })[]): { teams: [string, string][]; unpaired: RatedEntrant[] } {
  const males = entrants.filter((entrant) => entrant.gender === "MALE").sort((a, b) => b.skillRating - a.skillRating);
  const females = entrants.filter((entrant) => entrant.gender === "FEMALE").sort((a, b) => b.skillRating - a.skillRating);
  const rest = entrants.filter((entrant) => entrant.gender !== "MALE" && entrant.gender !== "FEMALE");
  const teams: [string, string][] = [];
  const pairCount = Math.min(males.length, females.length);
  for (let i = 0; i < pairCount; i++) teams.push([males[i].userId, females[pairCount - 1 - i].userId]);
  const unpaired = [...males.slice(pairCount), ...females.slice(pairCount), ...rest];
  return { teams, unpaired };
}

/** Same gender constraint as formMixedTeamsBalanced, but pairs randomly within each gender bucket instead of by rating. */
export function formMixedTeamsRandom(entrants: { userId: string; gender: Gender | null }[]): { teams: [string, string][]; unpaired: { userId: string; gender: Gender | null }[] } {
  const males = shuffle(entrants.filter((entrant) => entrant.gender === "MALE"));
  const females = shuffle(entrants.filter((entrant) => entrant.gender === "FEMALE"));
  const rest = entrants.filter((entrant) => entrant.gender !== "MALE" && entrant.gender !== "FEMALE");
  const pairCount = Math.min(males.length, females.length);
  const teams: [string, string][] = Array.from({ length: pairCount }, (_, i) => [males[i].userId, females[i].userId]);
  const unpaired = [...males.slice(pairCount), ...females.slice(pairCount), ...rest];
  return { teams, unpaired };
}

/** Splits `total` items across `groupCount` groups as evenly as possible (sizes differ by at most 1). */
export function distributeIntoGroups(total: number, groupCount: number): number[] {
  if (groupCount <= 0) return [];
  const base = Math.floor(total / groupCount);
  const remainder = total % groupCount;
  return Array.from({ length: groupCount }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function groupCountFromTargetSize(total: number, targetPerGroup: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, targetPerGroup)));
}

/** Randomly assigns teams to N groups, sized as evenly as possible via distributeIntoGroups. */
export function assignGroupsRandom(teamIds: string[], groupCount: number): string[][] {
  const sizes = distributeIntoGroups(teamIds.length, groupCount);
  const shuffled = shuffle(teamIds);
  const groups: string[][] = [];
  let cursor = 0;
  for (const size of sizes) {
    groups.push(shuffled.slice(cursor, cursor + size));
    cursor += size;
  }
  return groups;
}

/**
 * Seeded (snake draft) group assignment: sorts teams strongest to weakest, then deals them out
 * 1,2,3...N,N...3,2,1 repeating, so each group ends up with a comparable spread of seeds instead
 * of the top group hoarding every strong team.
 */
export function assignGroupsSeeded(teamsBySeed: { id: string; seed: number }[], groupCount: number): string[][] {
  const sorted = [...teamsBySeed].sort((a, b) => a.seed - b.seed);
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  let groupIndex = 0;
  let direction = 1;
  for (const team of sorted) {
    groups[groupIndex].push(team.id);
    if (groupIndex + direction >= groupCount || groupIndex + direction < 0) direction *= -1;
    else groupIndex += direction;
  }
  return groups;
}

export type PoolMatchResult = { tournamentTeamAId: string | null; tournamentTeamBId: string | null; scores: { sideAScore: number; sideBScore: number }[] };
export type PoolTeamStanding = { teamId: string; wins: number; losses: number; scored: number; conceded: number; differential: number; rank: number };

/** Shared win/loss/points math for a pool's teams, used by both the standings endpoint and bracket seeding so they can never disagree. */
export function computeTeamStandings(teamIds: string[], matches: PoolMatchResult[]): PoolTeamStanding[] {
  const stats = new Map(teamIds.map((teamId) => [teamId, { teamId, wins: 0, losses: 0, scored: 0, conceded: 0 }]));
  for (const match of matches) {
    if (!match.tournamentTeamAId || !match.tournamentTeamBId) continue;
    const teamA = stats.get(match.tournamentTeamAId);
    const teamB = stats.get(match.tournamentTeamBId);
    if (!teamA || !teamB) continue;
    for (const score of match.scores) {
      teamA.scored += score.sideAScore;
      teamA.conceded += score.sideBScore;
      teamB.scored += score.sideBScore;
      teamB.conceded += score.sideAScore;
      if (score.sideAScore > score.sideBScore) { teamA.wins += 1; teamB.losses += 1; } else { teamB.wins += 1; teamA.losses += 1; }
    }
  }
  return [...stats.values()]
    .sort((a, b) => b.wins - a.wins || (b.scored - b.conceded) - (a.scored - a.conceded))
    .map((entry, index) => ({ ...entry, differential: entry.scored - entry.conceded, rank: index + 1 }));
}

export type BracketQualifier = { teamId: string; seed: number };
export type BracketMatchPlan = { round: number; position: number; teamAId: string | null; teamBId: string | null; nextRound: number | null; nextPosition: number | null; nextSlot: "A" | "B" | null };

export function nextPowerOfTwo(n: number): number {
  let power = 1;
  while (power < n) power *= 2;
  return power;
}

/** Standard bracket seed placement (1v4/2v3 for 4, 1v8/4v5/2v7/3v6 for 8, ...) so top seeds meet as late as possible and any byes land on the strongest seeds. */
export function standardSeedOrder(bracketSize: number): number[] {
  let seeds = [1];
  while (seeds.length < bracketSize) {
    const size = seeds.length * 2;
    const next: number[] = [];
    for (const seed of seeds) { next.push(seed); next.push(size + 1 - seed); }
    seeds = next;
  }
  return seeds;
}

/** Ranks each pool's advancing teams into a single global seed order: all 1st-place finishers first (tiebroken by wins then differential), then all 2nd-place finishers, and so on. */
export function seedQualifiers(qualifiers: { teamId: string; poolRank: number; wins: number; differential: number }[]): BracketQualifier[] {
  return [...qualifiers]
    .sort((a, b) => a.poolRank - b.poolRank || b.wins - a.wins || b.differential - a.differential)
    .map((qualifier, index) => ({ teamId: qualifier.teamId, seed: index + 1 }));
}

/**
 * Builds a full single-elimination bracket from a seeded qualifier list. Byes only ever occur in
 * round 1 (a well-formed bracket derived from nextPowerOfTwo never needs a bye later) and are
 * resolved immediately -- the bye recipient advances with no match played, sometimes landing
 * directly opposite another bye recipient in round 2, which is a real, immediately playable
 * match rather than a further bye.
 */
export function buildBracket(qualifiers: BracketQualifier[]): BracketMatchPlan[] {
  if (qualifiers.length < 2) return [];
  const bracketSize = nextPowerOfTwo(qualifiers.length);
  const seedOrder = standardSeedOrder(bracketSize);
  const teamBySeed = new Map(qualifiers.map((qualifier) => [qualifier.seed, qualifier.teamId]));
  let slotTeams: (string | null)[] = seedOrder.map((seed) => teamBySeed.get(seed) ?? null);
  const totalRounds = Math.log2(bracketSize);
  const plans: BracketMatchPlan[] = [];

  for (let round = 1; round <= totalRounds; round++) {
    const isLastRound = round === totalRounds;
    const nextSlotTeams: (string | null)[] = [];
    for (let i = 0; i < slotTeams.length / 2; i++) {
      const teamA = slotTeams[i * 2];
      const teamB = slotTeams[i * 2 + 1];
      if (round === 1 && (!teamA || !teamB)) {
        nextSlotTeams.push(teamA ?? teamB ?? null); // true bye: advance with no match
        continue;
      }
      plans.push({ round, position: i, teamAId: teamA, teamBId: teamB, nextRound: isLastRound ? null : round + 1, nextPosition: isLastRound ? null : Math.floor(i / 2), nextSlot: isLastRound ? null : (i % 2 === 0 ? "A" : "B") });
      nextSlotTeams.push(null); // winner unknown until this match is scored
    }
    slotTeams = nextSlotTeams;
  }
  return plans;
}

export function bracketRoundLabel(round: number, totalRounds: number): string {
  const roundsFromEnd = totalRounds - round;
  if (roundsFromEnd === 0) return "Final";
  if (roundsFromEnd === 1) return "Semifinal";
  if (roundsFromEnd === 2) return "Quarterfinal";
  return `Round of ${2 ** (roundsFromEnd + 1)}`;
}

/**
 * Full round-robin schedule for a fixed set of team units within one pool: every team plays
 * every other team in the pool exactly once. Same circle-method rotation used for fixed-partner
 * round robins, applied to whole teams instead of individual players.
 */
export function generatePoolRounds(teamIds: string[]): { roundNumber: number; matchups: [string, string][] }[] {
  if (teamIds.length < 2) return [];
  let units = [...teamIds];
  if (units.length % 2) units.push("BYE");
  const roundCount = units.length - 1;
  const rounds: { roundNumber: number; matchups: [string, string][] }[] = [];
  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber++) {
    const matchups: [string, string][] = [];
    for (let index = 0; index < units.length / 2; index++) {
      const teamA = units[index];
      const teamB = units[units.length - 1 - index];
      if (teamA !== "BYE" && teamB !== "BYE") matchups.push([teamA, teamB]);
    }
    rounds.push({ roundNumber, matchups });
    const fixed = units[0];
    const rotating = units.slice(1);
    rotating.unshift(rotating.pop()!);
    units = [fixed, ...rotating];
  }
  return rounds;
}
