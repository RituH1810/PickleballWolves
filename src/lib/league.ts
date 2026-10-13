export type LeagueMatchResult = { teamAId: string | null; teamBId: string | null; scores: { sideAScore: number; sideBScore: number }[] };
export type LeagueTeamStanding = { teamId: string; wins: number; losses: number; scored: number; conceded: number; differential: number; rank: number };

/**
 * Same win/loss/differential/rank algorithm as tournament.ts's computeTeamStandings, kept as a
 * separate function (generic teamAId/teamBId instead of tournamentTeamAId/tournamentTeamBId) so
 * League code never has to touch -- or risk -- the tournament-tested original.
 */
export function computeLeagueStandings(teamIds: string[], matches: LeagueMatchResult[]): LeagueTeamStanding[] {
  const stats = new Map(teamIds.map((teamId) => [teamId, { teamId, wins: 0, losses: 0, scored: 0, conceded: 0 }]));
  for (const match of matches) {
    if (!match.teamAId || !match.teamBId) continue;
    const teamA = stats.get(match.teamAId);
    const teamB = stats.get(match.teamBId);
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
