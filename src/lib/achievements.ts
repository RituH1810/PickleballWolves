export type AchievementTier = "bronze" | "silver" | "gold";
export type AchievementIcon = "sparkles" | "star" | "repeat" | "target" | "medal" | "award" | "zap" | "flame" | "circle-dot" | "rotate-ccw" | "swords" | "handshake" | "users" | "trending-up" | "crown" | "trophy";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: AchievementIcon;
  tier: AchievementTier;
  unlocked: boolean;
  unlockedAt: Date | null;
  progress: { current: number; target: number };
};

export type AchievementMatch = {
  id: string;
  playedAt: Date;
  roundRobinId: string | null;
  winnerSide: "A" | "B" | null;
  players: { userId: string; side: "A" | "B" }[];
  scores: { gameNumber: number; sideAScore: number; sideBScore: number }[];
};

export type AchievementInput = {
  userId: string;
  matches: AchievementMatch[];
  // Pre-match skill rating of every player, keyed `${matchId}:${userId}`. Matches scored before
  // RatingHistory existed simply have no entries and can't count toward Giant Slayer.
  ratingBefore: Map<string, number>;
  // This player's own skill-rating history, any order.
  ratingHistory: { ratingBefore: number; ratingAfter: number; createdAt: Date }[];
  ladderTopAt: Date | null;
  championAt: Date | null;
};

// Beating a side whose average pre-match rating is at least this much higher counts as an upset.
export const GIANT_SLAYER_GAP = 0.5;
export const RISING_STAR_GAIN = 0.5;

type Definition = Omit<Achievement, "unlocked" | "unlockedAt" | "progress"> & { target: number };

const DEFINITIONS: Definition[] = [
  { id: "opening-serve", name: "Opening Serve", description: "Play your first match.", icon: "sparkles", tier: "bronze", target: 1 },
  { id: "first-win", name: "First Win", description: "Win your first match.", icon: "star", tier: "bronze", target: 1 },
  { id: "regular", name: "Regular", description: "Play 10 matches.", icon: "repeat", tier: "bronze", target: 10 },
  { id: "grinder", name: "Grinder", description: "Play 50 matches.", icon: "target", tier: "silver", target: 50 },
  { id: "centurion", name: "Centurion", description: "Play 100 matches.", icon: "medal", tier: "gold", target: 100 },
  { id: "pack-leader", name: "Pack Leader", description: "Win 25 matches.", icon: "award", tier: "silver", target: 25 },
  { id: "hot-hand", name: "Hot Hand", description: "Win 3 matches in a row.", icon: "zap", tier: "bronze", target: 3 },
  { id: "on-fire", name: "On Fire", description: "Win 5 matches in a row.", icon: "flame", tier: "silver", target: 5 },
  { id: "unstoppable", name: "Unstoppable", description: "Win 10 matches in a row.", icon: "flame", tier: "gold", target: 10 },
  { id: "bagel", name: "Bagel", description: "Win a game without giving up a point.", icon: "circle-dot", tier: "silver", target: 1 },
  { id: "comeback", name: "Comeback", description: "Lose the first game, then win the match.", icon: "rotate-ccw", tier: "silver", target: 1 },
  { id: "giant-slayer", name: "Giant Slayer", description: `Beat a side rated ${GIANT_SLAYER_GAP.toFixed(1)}+ higher than yours.`, icon: "swords", tier: "gold", target: 1 },
  { id: "mixer", name: "Mixer", description: "Partner with 10 different players.", icon: "handshake", tier: "silver", target: 10 },
  { id: "round-robin-regular", name: "Round Robin Regular", description: "Play in 5 different round robins.", icon: "users", tier: "bronze", target: 5 },
  { id: "rising-star", name: "Rising Star", description: `Raise your skill rating by ${RISING_STAR_GAIN.toFixed(1)}.`, icon: "trending-up", tier: "gold", target: RISING_STAR_GAIN },
  { id: "ladder-king", name: "Ladder King", description: "Hold the #1 spot on a ladder.", icon: "crown", tier: "gold", target: 1 },
  { id: "champion", name: "Champion", description: "Win a tournament final.", icon: "trophy", tier: "gold", target: 1 },
];

/** Same rule as the rest of the app: trust winnerSide when it's set, otherwise total points decide. */
function winningSide(match: AchievementMatch): "A" | "B" | null {
  if (match.winnerSide) return match.winnerSide;
  const margin = match.scores.reduce((total, score) => total + score.sideAScore - score.sideBScore, 0);
  return margin > 0 ? "A" : margin < 0 ? "B" : null;
}

function averageRating(match: AchievementMatch, side: "A" | "B", ratingBefore: Map<string, number>) {
  const ratings = match.players.filter((player) => player.side === side).map((player) => ratingBefore.get(`${match.id}:${player.userId}`));
  if (!ratings.length || ratings.some((rating) => rating === undefined)) return null;
  return (ratings as number[]).reduce((total, rating) => total + rating, 0) / ratings.length;
}

/**
 * Works every badge out from the player's history rather than storing unlocks, so badges are
 * retroactive and can never drift out of sync with edited or deleted matches. Matches are walked
 * oldest-first so each badge's unlockedAt is the match that actually earned it.
 */
export function computeAchievements(input: AchievementInput): Achievement[] {
  const unlockedAt = new Map<string, Date>();
  const progress = new Map<string, number>();
  const bump = (id: string, value: number, at: Date) => {
    const definition = DEFINITIONS.find((entry) => entry.id === id)!;
    progress.set(id, Math.max(progress.get(id) ?? 0, value));
    if (value >= definition.target && !unlockedAt.has(id)) unlockedAt.set(id, at);
  };

  let played = 0;
  let wins = 0;
  let streak = 0;
  const partners = new Set<string>();
  const roundRobins = new Set<string>();

  const matches = [...input.matches].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  for (const match of matches) {
    const mine = match.players.find((player) => player.userId === input.userId);
    if (!mine) continue;
    const theirSide = mine.side === "A" ? "B" : "A";
    const won = winningSide(match) === mine.side;
    const at = match.playedAt;

    played += 1;
    for (const id of ["opening-serve", "regular", "grinder", "centurion"]) bump(id, played, at);

    if (won) {
      wins += 1;
      streak += 1;
    } else {
      streak = 0;
    }
    for (const id of ["first-win", "pack-leader"]) bump(id, wins, at);
    for (const id of ["hot-hand", "on-fire", "unstoppable"]) bump(id, streak, at);

    const games = [...match.scores].sort((a, b) => a.gameNumber - b.gameNumber).map((score) => ({ mine: mine.side === "A" ? score.sideAScore : score.sideBScore, theirs: mine.side === "A" ? score.sideBScore : score.sideAScore }));
    if (games.some((game) => game.mine > 0 && game.theirs === 0)) bump("bagel", 1, at);
    if (won && games.length >= 2 && games[0].mine < games[0].theirs) bump("comeback", 1, at);

    if (won) {
      const myRating = averageRating(match, mine.side, input.ratingBefore);
      const theirRating = averageRating(match, theirSide, input.ratingBefore);
      // Round to cents first so 3.0 vs 3.5 isn't lost to floating-point error.
      if (myRating !== null && theirRating !== null && Math.round((theirRating - myRating) * 100) >= Math.round(GIANT_SLAYER_GAP * 100)) bump("giant-slayer", 1, at);
    }

    match.players.filter((player) => player.side === mine.side && player.userId !== input.userId).forEach((player) => partners.add(player.userId));
    bump("mixer", partners.size, at);

    if (match.roundRobinId) roundRobins.add(match.roundRobinId);
    bump("round-robin-regular", roundRobins.size, at);
  }

  const history = [...input.ratingHistory].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  if (history.length) {
    const start = history[0].ratingBefore;
    for (const entry of history) bump("rising-star", Math.round((entry.ratingAfter - start) * 100) / 100, entry.createdAt);
  }

  if (input.ladderTopAt) bump("ladder-king", 1, input.ladderTopAt);
  if (input.championAt) bump("champion", 1, input.championAt);

  return DEFINITIONS.map(({ target, ...definition }) => ({
    ...definition,
    unlocked: unlockedAt.has(definition.id),
    unlockedAt: unlockedAt.get(definition.id) ?? null,
    progress: { current: Math.min(Math.max(progress.get(definition.id) ?? 0, 0), target), target },
  }));
}
