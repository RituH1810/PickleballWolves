import { CLOSE_GAME_MARGIN } from "./clutch";
import { computeHallOfFame, groupGames, UNDEFEATED_MIN_GAMES, type HallOfFameRecord, type HallOfFameRoundRobin } from "./hall-of-fame";
import { computeRecap } from "./round-robin-recap";

type PlayerRef = { userId: string; name: string };

/** One member's numbers in the group, game by game like the Hall of Fame. */
export type PlayerHallStats = PlayerRef & {
  games: number;
  wins: number;
  nights: number;
  titles: number;
  bestStreak: number;
  currentStreak: number;
  biggestWin: number;
  bestNight: number;
  undefeated: number;
  closeLosses: number;
  mostGamesNight: number;
};

/** Every member's numbers across these round robins (guests are left out). */
export function playerHallStats(roundRobins: HallOfFameRoundRobin[], guestIds = new Set<string>()): Map<string, PlayerHallStats> {
  const stats = new Map<string, PlayerHallStats>();
  const of = (player: PlayerRef) => {
    let entry = stats.get(player.userId);
    if (!entry) {
      entry = { ...player, games: 0, wins: 0, nights: 0, titles: 0, bestStreak: 0, currentStreak: 0, biggestWin: 0, bestNight: 0, undefeated: 0, closeLosses: 0, mostGamesNight: 0 };
      stats.set(player.userId, entry);
    }
    return entry;
  };
  const nights = new Map<string, { player: PlayerHallStats; wins: number; losses: number }>();
  for (const game of groupGames(roundRobins)) {
    const margin = game.winnerScore - game.loserScore;
    for (const [players, won] of [[game.winners, true], [game.losers, false]] as const) {
      for (const player of players.filter((entry) => !guestIds.has(entry.userId))) {
        const entry = of(player);
        entry.games += 1;
        if (won) {
          entry.wins += 1;
          entry.currentStreak += 1;
          entry.bestStreak = Math.max(entry.bestStreak, entry.currentStreak);
          entry.biggestWin = Math.max(entry.biggestWin, margin);
        } else {
          entry.currentStreak = 0;
          if (margin <= CLOSE_GAME_MARGIN) entry.closeLosses += 1;
        }
        const key = `${game.roundRobin.id}:${player.userId}`;
        const night = nights.get(key) ?? { player: entry, wins: 0, losses: 0 };
        if (won) night.wins += 1; else night.losses += 1;
        nights.set(key, night);
      }
    }
  }
  for (const { player, wins, losses } of nights.values()) {
    player.nights += 1;
    player.bestNight = Math.max(player.bestNight, wins);
    player.mostGamesNight = Math.max(player.mostGamesNight, wins + losses);
    if (!losses && wins >= UNDEFEATED_MIN_GAMES) player.undefeated += 1;
  }
  for (const roundRobin of roundRobins) {
    for (const champion of computeRecap(roundRobin.matches)?.champions ?? []) {
      if (!guestIds.has(champion.userId)) of(champion).titles += 1;
    }
  }
  return stats;
}

/** The records with a history: each time a night set a new value (or new holders), oldest first. */
export const HISTORY_KEYS: HallOfFameRecord["key"][] = ["titles", "streak", "biggestWin", "bestNight", "undefeated"];
export type RecordReign = { value: string; holders: PlayerRef[]; at: Date; roundRobin: { id: string; name: string } };

const holderKey = (record: HallOfFameRecord) => record.holders.map((holder) => holder.userId).sort().join(",");

/** Replays the group's nights in order and notes each time a record's mark went up or someone tied it. */
export function recordHistory(roundRobins: HallOfFameRoundRobin[], guestIds = new Set<string>()): Record<string, RecordReign[]> {
  const ordered = [...roundRobins].sort((a, b) => a.endedAt.getTime() - b.endedAt.getTime());
  const history: Record<string, RecordReign[]> = Object.fromEntries(HISTORY_KEYS.map((key) => [key, []]));
  for (let index = 0; index < ordered.length; index++) {
    const night = ordered[index];
    for (const record of computeHallOfFame(ordered.slice(0, index + 1), guestIds)) {
      const reigns = history[record.key];
      if (!reigns) continue;
      const last = reigns[reigns.length - 1];
      // A new reign when the mark goes up, or when someone ties it and joins the holders.
      const tiedIn = last && last.value === record.value && holderKey(record) !== last.holders.map((holder) => holder.userId).sort().join(",") && last.holders.every((holder) => record.holders.some((entry) => entry.userId === holder.userId));
      if (last && last.value === record.value && !tiedIn) continue;
      reigns.push({ value: record.value, holders: record.holders.map(({ userId, name }) => ({ userId, name })), at: night.endedAt, roundRobin: { id: night.id, name: night.name } });
    }
  }
  return history;
}

export type Chase = { userId: string; name: string; key: HallOfFameRecord["key"]; text: string; gap: number };

/**
 * Members close to a record: a live win streak at least half the record (3+), or within one of
 * the most titles / undefeated nights (2+), or 15 games of the most games. Closest first, top 3.
 */
export function recordChases(stats: Map<string, PlayerHallStats>, records: HallOfFameRecord[]): Chase[] {
  const recordOf = (key: HallOfFameRecord["key"]) => records.find((record) => record.key === key);
  const holds = (key: HallOfFameRecord["key"], userId: string) => recordOf(key)?.holders.some((holder) => holder.userId === userId) ?? false;
  const best = (key: "titles" | "bestStreak" | "undefeated" | "games") => Math.max(0, ...[...stats.values()].map((entry) => entry[key]));
  const chases: Chase[] = [];
  const first = (name: string) => name.split(" ")[0];
  for (const entry of stats.values()) {
    const streak = best("bestStreak");
    if (entry.currentStreak >= 3 && entry.currentStreak * 2 >= streak) {
      const gap = streak - entry.currentStreak;
      const owner = recordOf("streak")?.holders.map((holder) => first(holder.name)).join(" & ") ?? "the record";
      chases.push({ userId: entry.userId, name: entry.name, key: "streak", gap, text: gap > 0 ? `${first(entry.name)} has won ${entry.currentStreak} in a row -- ${gap} away from ${owner}'s ${streak}` : `${first(entry.name)} is on a record ${entry.currentStreak}-game streak and counting` });
    }
    for (const [key, field, word] of [["titles", "titles", "title"], ["undefeated", "undefeated", "undefeated night"]] as const) {
      const top = best(field);
      if (top >= 2 && !holds(key, entry.userId) && top - entry[field] === 1) chases.push({ userId: entry.userId, name: entry.name, key, gap: 1, text: `${first(entry.name)} is one ${word} away from tying the record (${top})` });
    }
    const games = best("games");
    if (!holds("games", entry.userId) && games - entry.games > 0 && games - entry.games <= 15) chases.push({ userId: entry.userId, name: entry.name, key: "games", gap: games - entry.games, text: `${first(entry.name)} is ${games - entry.games} games from the most played (${games})` });
  }
  return chases.sort((a, b) => a.gap - b.gap).slice(0, 3);
}

export type Placing = { key: string; label: string; rank: number; of: number; value: string };

/** Where one member ranks on each record (players level share a rank), among members with a value. */
export function yourPlace(stats: Map<string, PlayerHallStats>, userId: string): Placing[] {
  const me = stats.get(userId);
  if (!me) return [];
  const fields: [keyof PlayerHallStats & string, string, (value: number) => string][] = [
    ["titles", "Round robin titles", (value) => `${value}`],
    ["bestStreak", "Longest win streak", (value) => `${value} games`],
    ["bestNight", "Most wins in a night", (value) => `${value} wins`],
    ["biggestWin", "Biggest win", (value) => `+${value}`],
    ["undefeated", "Undefeated nights", (value) => `${value}`],
    ["games", "Games played", (value) => `${value}`],
  ];
  return fields.flatMap(([field, label, format]) => {
    const value = me[field] as number;
    if (!value) return [];
    const others = [...stats.values()].map((entry) => entry[field] as number).filter((entry) => entry > 0);
    return [{ key: field, label, rank: 1 + others.filter((entry) => entry > value).length, of: others.length, value: format(value) }];
  });
}

export const CLUBS = [
  { key: "games100", label: "100 Games Club", field: "games", target: 100 },
  { key: "wins50", label: "50 Wins Club", field: "wins", target: 50 },
  { key: "nights10", label: "10 Nights Club", field: "nights", target: 10 },
] as const;
export type Club = { key: string; label: string; members: (PlayerRef & { joinedAt: Date })[] };

/** Each club's members and the date they got in, earliest first. */
export function milestoneClubs(roundRobins: HallOfFameRoundRobin[], guestIds = new Set<string>()): Club[] {
  const counts = new Map<string, { games: number; wins: number; nights: Set<string> }>();
  const joined = new Map<string, Map<string, PlayerRef & { joinedAt: Date }>>(CLUBS.map((club) => [club.key, new Map()]));
  for (const game of groupGames(roundRobins)) {
    for (const [players, won] of [[game.winners, true], [game.losers, false]] as const) {
      for (const player of players.filter((entry) => !guestIds.has(entry.userId))) {
        const count = counts.get(player.userId) ?? { games: 0, wins: 0, nights: new Set<string>() };
        count.games += 1;
        if (won) count.wins += 1;
        count.nights.add(game.roundRobin.id);
        counts.set(player.userId, count);
        const values = { games: count.games, wins: count.wins, nights: count.nights.size };
        for (const club of CLUBS) {
          const members = joined.get(club.key)!;
          if (values[club.field] >= club.target && !members.has(player.userId)) members.set(player.userId, { userId: player.userId, name: player.name, joinedAt: game.playedAt });
        }
      }
    }
  }
  return CLUBS.map((club) => ({ key: club.key, label: club.label, members: [...joined.get(club.key)!.values()] }));
}

export type GritRecord = { key: string; label: string; value: string; holders: PlayerRef[]; detail: string };

/** Effort records: most games in one night, most close losses, and the longest game (most points). */
export function hallOfGrit(roundRobins: HallOfFameRoundRobin[], stats: Map<string, PlayerHallStats>): GritRecord[] {
  const records: GritRecord[] = [];
  const leaders = (field: "mostGamesNight" | "closeLosses") => {
    const top = Math.max(0, ...[...stats.values()].map((entry) => entry[field]));
    return { top, holders: top ? [...stats.values()].filter((entry) => entry[field] === top).map(({ userId, name }) => ({ userId, name })) : [] };
  };
  const marathon = leaders("mostGamesNight");
  if (marathon.top) records.push({ key: "marathon", label: "Most games in one night", value: `${marathon.top}`, holders: marathon.holders, detail: `${marathon.top} games played in a single round robin` });
  const fighter = leaders("closeLosses");
  if (fighter.top) records.push({ key: "fighter", label: "Never out of it", value: `${fighter.top}`, holders: fighter.holders, detail: `${fighter.top} losses by ${CLOSE_GAME_MARGIN} points or fewer -- always made them earn it` });
  const longest = groupGames(roundRobins).reduce<ReturnType<typeof groupGames>[number] | null>((best, game) => (!best || game.winnerScore + game.loserScore > best.winnerScore + best.loserScore ? game : best), null);
  if (longest) records.push({ key: "longest", label: "Longest game", value: `${longest.winnerScore}-${longest.loserScore}`, holders: [...longest.winners, ...longest.losers].filter((player) => stats.has(player.userId)).map(({ userId, name }) => ({ userId, name })), detail: `${longest.winnerScore + longest.loserScore} points at ${longest.roundRobin.name}` });
  return records;
}
