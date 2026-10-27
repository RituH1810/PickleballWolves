import { achievementInfo } from "./achievements";
import { groupGames, type HallOfFameRoundRobin } from "./hall-of-fame";
import { computeRecap } from "./round-robin-recap";

/** How far back the feed goes. */
export const FEED_DAYS = 30;
/** Most items the feed returns. */
export const FEED_LIMIT = 50;
/** Rating milestones: the first time a player reaches each of these. */
export const RATING_MILESTONES = [3, 3.5, 4, 4.5, 5, 5.5];
/** Games-in-the-group milestones. */
export const GAME_MILESTONES = [25, 50, 100, 200, 300, 400, 500];
/** Win streaks are announced at every multiple of this. */
export const STREAK_STEP = 5;
/** Games the group must have played before a biggest-win record counts as news. */
const RECORD_MIN_GAMES = 10;

type PlayerRef = { userId: string; name: string };
export type FeedKind = "champion" | "rating" | "streak" | "games" | "record" | "badge" | "potw" | "joined";
export type FeedItem = { id: string; kind: FeedKind; at: Date; players: PlayerRef[]; text: string; href: string | null };

export type FeedInput = {
  roundRobins: HallOfFameRoundRobin[];
  /** Every rating change for the group's members, any order. */
  ratingRows: { userId: string; ratingBefore: number; ratingAfter: number; createdAt: Date }[];
  unlocks: { userId: string; achievementId: string; unlockedAt: Date }[];
  playersOfTheWeek: { userId: string; weekStart: Date; createdAt: Date }[];
  joins: { userId: string; joinedAt: Date }[];
  /** Active members by id; only they appear in the feed. */
  members: Map<string, string>;
  now: Date;
};

const names = (players: PlayerRef[]) => players.length > 2 ? `${players.slice(0, -1).map((player) => player.name).join(", ")} and ${players.at(-1)!.name}` : players.map((player) => player.name).join(" and ");
const ordinal = (value: number) => `${value}${value % 100 >= 11 && value % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][value % 10] ?? "th"}`;

/**
 * The group's recent moments worth cheering, newest first: round robin champions, rating and
 * games milestones, win streaks, new group records, silver and gold badges, Players of the Week and
 * new members. Worked out from existing results, so nothing extra is stored; ids are stable so
 * reactions stay attached.
 */
export function computeGroupFeed(input: FeedInput): FeedItem[] {
  const since = new Date(input.now.getTime() - FEED_DAYS * 86_400_000);
  const member = (userId: string): PlayerRef | null => input.members.has(userId) ? { userId, name: input.members.get(userId)! } : null;
  const items: FeedItem[] = [];

  for (const roundRobin of input.roundRobins) {
    const champions = (computeRecap(roundRobin.matches)?.champions ?? []).filter((entry) => input.members.has(entry.userId));
    if (!champions.length) continue;
    const record = `${champions[0].wins}-${champions[0].losses}`;
    items.push({ id: `champion:${roundRobin.id}`, kind: "champion", at: roundRobin.endedAt, players: champions.map(({ userId, name }) => ({ userId, name })), text: `${names(champions)} ${champions.length > 1 ? "shared the win at" : "won"} ${roundRobin.name} (${record})`, href: `/round-robin/${roundRobin.id}` });
  }

  // Games, streaks and records from the group's games, oldest first.
  const played = new Map<string, number>();
  const running = new Map<string, number>();
  // The group's best streak when each player's current run began, and whether the run already made news as a record.
  const runBase = new Map<string, { best: number; announced: boolean }>();
  let bestStreak = 0;
  let bestMargin = 0;
  const games = groupGames(input.roundRobins);
  games.forEach((game, index) => {
    const href = `/round-robin/${game.roundRobin.id}`;
    for (const player of game.losers) running.set(player.userId, 0);
    for (const player of [...game.winners, ...game.losers]) {
      const count = (played.get(player.userId) ?? 0) + 1;
      played.set(player.userId, count);
      const who = member(player.userId);
      if (who && GAME_MILESTONES.includes(count)) items.push({ id: `games:${player.userId}:${count}`, kind: "games", at: game.playedAt, players: [who], text: `${who.name} played their ${ordinal(count)} game in the group`, href: null });
    }
    for (const player of game.winners) {
      const run = (running.get(player.userId) ?? 0) + 1;
      running.set(player.userId, run);
      if (run === 1) runBase.set(player.userId, { best: bestStreak, announced: false });
      const base = runBase.get(player.userId)!;
      const who = member(player.userId);
      if (!who) { bestStreak = Math.max(bestStreak, run); continue; }
      if (run > base.best && run >= STREAK_STEP && !base.announced) {
        base.announced = true;
        items.push({ id: `record:streak:${player.userId}:${run}:${game.matchId}`, kind: "record", at: game.playedAt, players: [who], text: `New group record: ${who.name} has won ${run} games in a row`, href });
      } else if (run % STREAK_STEP === 0) items.push({ id: `streak:${player.userId}:${game.matchId}:${game.order}`, kind: "streak", at: game.playedAt, players: [who], text: `${who.name} won ${run} games in a row`, href });
      bestStreak = Math.max(bestStreak, run);
    }
    const margin = game.winnerScore - game.loserScore;
    const winners = game.winners.map((player) => member(player.userId)).filter((entry): entry is PlayerRef => entry !== null);
    if (margin > bestMargin && index >= RECORD_MIN_GAMES && winners.length) items.push({ id: `record:biggestWin:${game.matchId}:${game.order}`, kind: "record", at: game.playedAt, players: winners, text: `New group record: biggest win, ${game.winnerScore}-${game.loserScore} by ${names(winners)}`, href });
    bestMargin = Math.max(bestMargin, margin);
  });

  // The first time a player's rating reaches each milestone.
  const byUser = new Map<string, FeedInput["ratingRows"]>();
  for (const row of input.ratingRows) byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);
  for (const [userId, rows] of byUser) {
    const who = member(userId);
    if (!who) continue;
    let peak = -Infinity;
    for (const row of [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
      if (peak === -Infinity) peak = row.ratingBefore;
      for (const milestone of RATING_MILESTONES) {
        if (peak < milestone && row.ratingAfter >= milestone) items.push({ id: `rating:${userId}:${milestone}`, kind: "rating", at: row.createdAt, players: [who], text: `${who.name} reached a ${milestone.toFixed(1)} rating`, href: `/players/${userId}` });
      }
      peak = Math.max(peak, row.ratingAfter);
    }
  }

  for (const unlock of input.unlocks) {
    const who = member(unlock.userId);
    const badge = achievementInfo(unlock.achievementId);
    if (who && badge && badge.tier !== "bronze") items.push({ id: `badge:${unlock.userId}:${unlock.achievementId}`, kind: "badge", at: unlock.unlockedAt, players: [who], text: `${who.name} earned the ${badge.name} badge`, href: `/players/${unlock.userId}` });
  }
  for (const pick of input.playersOfTheWeek) {
    const who = member(pick.userId);
    if (who) items.push({ id: `potw:${pick.userId}:${pick.weekStart.toISOString()}`, kind: "potw", at: pick.createdAt, players: [who], text: `${who.name} is Player of the Week`, href: null });
  }
  for (const join of input.joins) {
    const who = member(join.userId);
    if (who) items.push({ id: `joined:${join.userId}`, kind: "joined", at: join.joinedAt, players: [who], text: `${who.name} joined the group -- say hi!`, href: `/players/${join.userId}` });
  }

  return items.filter((item) => item.at >= since && item.at <= input.now).sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, FEED_LIMIT);
}
