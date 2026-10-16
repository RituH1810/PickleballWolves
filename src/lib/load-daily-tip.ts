import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadAchievements } from "@/lib/load-achievements";
import { zonedParts } from "@/lib/recurring";
import { upcomingCutoff } from "@/lib/upcoming";
import { computeInsights, pickDailyTip, type TipGame, type TipInput } from "@/lib/daily-tip";

const DAY_MS = 86_400_000;
// "Today" for the tip follows the groups' local calendar.
const TIP_TIME_ZONE = "America/New_York";

// [singular, plural]. Streak badges are left out: their progress is the best-ever streak, not the
// current one, so "1 win to On Fire" would mislead.
const BADGE_UNITS: Record<string, [string, string]> = {
  "pack-leader": ["win", "wins"], regular: ["match", "matches"], grinder: ["match", "matches"], centurion: ["match", "matches"],
  mixer: ["new partner", "new partners"], "round-robin-regular": ["round robin", "round robins"], "rising-star": ["rating point", "rating points"],
};

export function tipDateKey(now = new Date()) {
  const local = zonedParts(now, TIP_TIME_ZONE);
  return `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
}

/** Everything the tip rules look at: the last 30 days of games, rating trend, next game, closest badge. */
export async function loadTipInput(userId: string, now = new Date()): Promise<TipInput | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!user) return null;
  const since = new Date(now.getTime() - 30 * DAY_MS);

  const [matches, ratingRows, lastMatch, nextGame, achievements] = await Promise.all([
    prisma.match.findMany({
      where: { status: MatchStatus.COMPLETED, deletedAt: null, updatedAt: { gte: since }, players: { some: { userId } }, scores: { some: {} } },
      select: { id: true, updatedAt: true, roundRobinId: true, players: { select: { userId: true, side: true, user: { select: { name: true } } } }, scores: { orderBy: { gameNumber: "asc" }, select: { sideAScore: true, sideBScore: true } } },
    }),
    prisma.ratingHistory.findMany({ where: { userId, ladderId: null, createdAt: { gte: new Date(now.getTime() - 14 * DAY_MS) } }, select: { ratingDelta: true } }),
    prisma.match.findFirst({ where: { status: MatchStatus.COMPLETED, deletedAt: null, players: { some: { userId } } }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    prisma.roundRobin.findFirst({ where: { status: { in: ["SETUP", "LIVE"] }, scheduledAt: { gte: upcomingCutoff(now) }, OR: [{ createdById: userId }, { rsvps: { some: { userId, status: "JOINED" } } }] }, orderBy: { scheduledAt: "asc" }, select: { name: true, scheduledAt: true } }),
    loadAchievements(userId),
  ]);

  // Where each match fell in its round robin night, by the order the matches were created.
  const roundRobinIds = [...new Set(matches.flatMap((match) => (match.roundRobinId ? [match.roundRobinId] : [])))];
  const sessionMatches = roundRobinIds.length ? await prisma.match.findMany({ where: { roundRobinId: { in: roundRobinIds }, deletedAt: null, scores: { some: {} } }, orderBy: { createdAt: "asc" }, select: { id: true, roundRobinId: true } }) : [];
  const order = new Map<string, number>();
  const size = new Map<string, number>();
  for (const match of sessionMatches) {
    const index = size.get(match.roundRobinId!) ?? 0;
    order.set(match.id, index);
    size.set(match.roundRobinId!, index + 1);
  }

  const games: TipGame[] = [];
  for (const match of matches) {
    const side = match.players.find((player) => player.userId === userId)!.side;
    const people = (onMySide: boolean) => match.players.filter((player) => (player.side === side) === onMySide && player.userId !== userId).map((player) => ({ userId: player.userId, name: player.user.name }));
    for (const score of match.scores) {
      const own = side === "A" ? score.sideAScore : score.sideBScore;
      const other = side === "A" ? score.sideBScore : score.sideAScore;
      if (own === other) continue;
      games.push({ playedAt: match.updatedAt, roundRobinId: match.roundRobinId, orderInSession: order.get(match.id) ?? 0, sessionSize: match.roundRobinId ? size.get(match.roundRobinId) ?? 1 : 1, won: own > other, margin: Math.abs(own - other), partners: people(true), opponents: people(false) });
    }
  }

  // The locked badge they're closest to, once they're at least 60% of the way there.
  const nearest = achievements
    .filter((achievement) => !achievement.unlocked && BADGE_UNITS[achievement.id] && achievement.progress.current / achievement.progress.target >= 0.6)
    .sort((a, b) => b.progress.current / b.progress.target - a.progress.current / a.progress.target)[0];
  const remaining = nearest ? Math.round((nearest.progress.target - nearest.progress.current) * 100) / 100 : 0;

  return {
    name: user.name,
    games,
    ratingChange14d: ratingRows.length ? Math.round(ratingRows.reduce((total, row) => total + Number(row.ratingDelta), 0) * 100) / 100 : null,
    lastPlayedAt: lastMatch?.updatedAt ?? null,
    nextGame: nextGame?.scheduledAt ? { name: nextGame.name, when: nextGame.scheduledAt.toLocaleString("en-US", { timeZone: TIP_TIME_ZONE, weekday: "short", hour: "numeric", minute: "2-digit" }) } : null,
    nearestBadge: nearest && remaining > 0 ? { name: nearest.name, description: nearest.description, remaining, unit: BADGE_UNITS[nearest.id][remaining === 1 ? 0 : 1] } : null,
  };
}

export async function loadDailyTip(userId: string, now = new Date()) {
  const input = await loadTipInput(userId, now);
  const dateKey = tipDateKey(now);
  const seed = [...userId].reduce((total, char) => total + char.charCodeAt(0), 0);
  return { dateKey, tip: pickDailyTip(input ? computeInsights(input, now) : [], dateKey, seed) };
}
