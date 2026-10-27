import { CLOSE_GAME_MARGIN, CLUTCH_MIN_GAMES } from "./clutch";
import { computeRecap, type RecapMatch } from "./round-robin-recap";
import { rankRoundRobinWinners } from "./round-robin-winners";

/** Fewest games together before a pair can be the group's best duo. */
export const DUO_MIN_GAMES = 5;
/** Fewest games in a night for winning them all to count as an undefeated night. */
export const UNDEFEATED_MIN_GAMES = 3;

export type HallOfFameRoundRobin = { id: string; name: string; endedAt: Date; matches: (RecapMatch & { playedAt: Date })[] };

type PlayerRef = { userId: string; name: string };
export type HallOfFameRecord = {
  key: "titles" | "streak" | "biggestWin" | "bestNight" | "undefeated" | "duo" | "clutch" | "games";
  label: string;
  value: string;
  holders: PlayerRef[];
  detail: string;
  roundRobin: { id: string; name: string } | null;
  at: Date | null;
};

export type GroupGame = { roundRobin: HallOfFameRoundRobin; matchId: string; playedAt: Date; order: number; winners: PlayerRef[]; losers: PlayerRef[]; winnerScore: number; loserScore: number };
type Game = GroupGame;

/** Every decided game in these round robins, oldest first (tied games are skipped). */
export function groupGames(roundRobins: HallOfFameRoundRobin[]): GroupGame[] {
  const games: GroupGame[] = [];
  for (const roundRobin of roundRobins) {
    for (const match of roundRobin.matches) {
      const side = (letter: "A" | "B") => match.players.filter((player) => player.side === letter).map(({ userId, name }) => ({ userId, name }));
      for (const score of [...match.scores].sort((a, b) => a.gameNumber - b.gameNumber)) {
        if (score.sideAScore === score.sideBScore) continue;
        const aWon = score.sideAScore > score.sideBScore;
        games.push({ roundRobin, matchId: match.id, playedAt: match.playedAt, order: score.gameNumber, winners: side(aWon ? "A" : "B"), losers: side(aWon ? "B" : "A"), winnerScore: Math.max(score.sideAScore, score.sideBScore), loserScore: Math.min(score.sideAScore, score.sideBScore) });
      }
    }
  }
  return games.sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime() || a.order - b.order);
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const names = (players: PlayerRef[]) => players.map((player) => player.name).join(" & ");

/** Everyone who ties the top value, the earliest to reach it first. */
function leaders<T extends { value: number; at: Date }>(entries: T[]) {
  const top = Math.max(0, ...entries.map((entry) => entry.value));
  return top > 0 ? entries.filter((entry) => entry.value === top).sort((a, b) => a.at.getTime() - b.at.getTime()) : [];
}

/**
 * A group's all-time records from its ended round robins. Each scored game is a win or loss, like
 * round robin standings (tied games are skipped). Guests can't hold records, but their games still
 * count for the players they faced. A record nobody has set yet is left out.
 */
export function computeHallOfFame(roundRobins: HallOfFameRoundRobin[], guestIds = new Set<string>()): HallOfFameRecord[] {
  const isMember = (player: PlayerRef) => !guestIds.has(player.userId);
  const games = groupGames(roundRobins);
  const records: HallOfFameRecord[] = [];

  const champions = rankRoundRobinWinners(roundRobins.map((roundRobin) => ({ endedAt: roundRobin.endedAt, champions: (computeRecap(roundRobin.matches)?.champions ?? []).filter(isMember) })))
    .filter((winner) => winner.rank === 1);
  if (champions.length) records.push({ key: "titles", label: "Most round robin titles", value: plural(champions[0].titles, "title"), holders: champions, detail: `Won ${plural(champions[0].titles, "round robin")}`, roundRobin: null, at: null });

  // Longest run of games won in a row, across nights.
  const running = new Map<string, number>();
  const streaks: (PlayerRef & { value: number; at: Date; roundRobin: HallOfFameRoundRobin })[] = [];
  for (const game of games) {
    for (const player of game.losers) running.set(player.userId, 0);
    for (const player of game.winners.filter(isMember)) {
      const count = (running.get(player.userId) ?? 0) + 1;
      running.set(player.userId, count);
      const best = streaks.find((entry) => entry.userId === player.userId);
      if (!best) streaks.push({ ...player, value: count, at: game.playedAt, roundRobin: game.roundRobin });
      else if (count > best.value) Object.assign(best, { value: count, at: game.playedAt, roundRobin: game.roundRobin });
    }
  }
  const streakLeaders = leaders(streaks);
  if (streakLeaders.length) records.push({ key: "streak", label: "Longest win streak", value: plural(streakLeaders[0].value, "game"), holders: streakLeaders, detail: `${plural(streakLeaders[0].value, "game")} won in a row`, roundRobin: null, at: streakLeaders[0].at });

  // The first game to reach the biggest margin holds the record.
  const blowout = games.filter((game) => game.winners.some(isMember)).reduce<Game | null>((best, game) => !best || game.winnerScore - game.loserScore > best.winnerScore - best.loserScore ? game : best, null);
  if (blowout) records.push({ key: "biggestWin", label: "Biggest win", value: `+${blowout.winnerScore - blowout.loserScore}`, holders: blowout.winners.filter(isMember), detail: `${blowout.winnerScore}-${blowout.loserScore} over ${names(blowout.losers)}`, roundRobin: { id: blowout.roundRobin.id, name: blowout.roundRobin.name }, at: blowout.playedAt });

  // Per player per night: wins, losses and differential.
  const nights = new Map<string, PlayerRef & { roundRobin: HallOfFameRoundRobin; wins: number; losses: number; differential: number }>();
  for (const game of games) {
    const margin = game.winnerScore - game.loserScore;
    for (const [players, won] of [[game.winners, true], [game.losers, false]] as const) {
      for (const player of players.filter(isMember)) {
        const key = `${game.roundRobin.id}:${player.userId}`;
        const night = nights.get(key) ?? { ...player, roundRobin: game.roundRobin, wins: 0, losses: 0, differential: 0 };
        if (won) night.wins += 1; else night.losses += 1;
        night.differential += won ? margin : -margin;
        nights.set(key, night);
      }
    }
  }
  const best = [...nights.values()].sort((a, b) => b.wins - a.wins || b.differential - a.differential || a.roundRobin.endedAt.getTime() - b.roundRobin.endedAt.getTime())[0];
  if (best?.wins) records.push({ key: "bestNight", label: "Most wins in one night", value: plural(best.wins, "win"), holders: [best], detail: `${best.wins}-${best.losses}, ${best.differential > 0 ? "+" : ""}${best.differential}`, roundRobin: { id: best.roundRobin.id, name: best.roundRobin.name }, at: best.roundRobin.endedAt });

  const perfect = new Map<string, PlayerRef & { value: number; at: Date }>();
  for (const night of nights.values()) {
    if (night.losses || night.wins < UNDEFEATED_MIN_GAMES) continue;
    const entry = perfect.get(night.userId) ?? { userId: night.userId, name: night.name, value: 0, at: night.roundRobin.endedAt };
    entry.value += 1;
    if (night.roundRobin.endedAt > entry.at) entry.at = night.roundRobin.endedAt;
    perfect.set(night.userId, entry);
  }
  const perfectLeaders = leaders([...perfect.values()]);
  if (perfectLeaders.length) records.push({ key: "undefeated", label: "Most undefeated nights", value: plural(perfectLeaders[0].value, "night"), holders: perfectLeaders, detail: `Won every game (${UNDEFEATED_MIN_GAMES}+) ${perfectLeaders[0].value === 1 ? "once" : `${perfectLeaders[0].value} times`}`, roundRobin: null, at: null });

  const duos = new Map<string, { players: PlayerRef[]; wins: number; played: number }>();
  for (const game of games) {
    for (const [players, won] of [[game.winners, true], [game.losers, false]] as const) {
      if (players.length !== 2 || !players.every(isMember)) continue;
      const pair = [...players].sort((a, b) => a.userId.localeCompare(b.userId));
      const key = pair.map((player) => player.userId).join(":");
      const duo = duos.get(key) ?? { players: pair, wins: 0, played: 0 };
      duo.played += 1;
      if (won) duo.wins += 1;
      duos.set(key, duo);
    }
  }
  const duo = [...duos.values()].filter((entry) => entry.played >= DUO_MIN_GAMES).sort((a, b) => b.wins / b.played - a.wins / a.played || b.played - a.played)[0];
  if (duo) records.push({ key: "duo", label: "Best duo", value: `${Math.round((duo.wins / duo.played) * 100)}%`, holders: duo.players, detail: `${duo.wins}-${duo.played - duo.wins} together (${DUO_MIN_GAMES}+ games)`, roundRobin: null, at: null });

  // Best win % in close games, with enough of them; ties go to more close games.
  const close = new Map<string, PlayerRef & { wins: number; played: number }>();
  for (const game of games.filter((entry) => entry.winnerScore - entry.loserScore <= CLOSE_GAME_MARGIN)) {
    for (const [players, won] of [[game.winners, true], [game.losers, false]] as const) {
      for (const player of players.filter(isMember)) {
        const entry = close.get(player.userId) ?? { ...player, wins: 0, played: 0 };
        entry.played += 1;
        if (won) entry.wins += 1;
        close.set(player.userId, entry);
      }
    }
  }
  const clutch = [...close.values()].filter((entry) => entry.played >= CLUTCH_MIN_GAMES).sort((a, b) => b.wins / b.played - a.wins / a.played || b.played - a.played)[0];
  if (clutch) records.push({ key: "clutch", label: "Most clutch", value: `${Math.round((clutch.wins / clutch.played) * 100)}%`, holders: [clutch], detail: `${clutch.wins}-${clutch.played - clutch.wins} in games decided by ${CLOSE_GAME_MARGIN} or fewer (${CLUTCH_MIN_GAMES}+ games)`, roundRobin: null, at: null });

  const played = new Map<string, PlayerRef & { value: number; at: Date }>();
  for (const game of games) {
    for (const player of [...game.winners, ...game.losers].filter(isMember)) {
      const entry = played.get(player.userId) ?? { ...player, value: 0, at: game.playedAt };
      entry.value += 1;
      entry.at = game.playedAt;
      played.set(player.userId, entry);
    }
  }
  const ironLeaders = leaders([...played.values()]);
  if (ironLeaders.length) records.push({ key: "games", label: "Most games played", value: String(ironLeaders[0].value), holders: ironLeaders, detail: `${plural(ironLeaders[0].value, "game")} in this group`, roundRobin: null, at: null });

  return records;
}
