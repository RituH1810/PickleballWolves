import { CLOSE_GAME_MARGIN } from "./clutch";

export type NicknameMatch = { id: string; roundRobinId: string | null; players: { userId: string; side: "A" | "B" }[]; scores: { sideAScore: number; sideBScore: number }[] };
export type Nickname = { key: string; emoji: string; label: string; reason: string };

/** At most this many nicknames on a profile, the most notable first. */
export const NICKNAMES_SHOWN = 3;

/**
 * Nicknames earned from a player's own numbers, game by game (tied games skipped). They come and
 * go as the stats move, unlike badges. `titles` is round robin titles won and `ratingGain30` the
 * rating gained over the last 30 days.
 */
export function computeNicknames({ matches, userId, titles = 0, ratingGain30 = 0 }: { matches: NicknameMatch[]; userId: string; titles?: number; ratingGain30?: number }): Nickname[] {
  let wins = 0;
  let losses = 0;
  let conceded = 0;
  let winMargin = 0;
  let lossMargin = 0;
  let closeWins = 0;
  let closeGames = 0;
  const partners = new Set<string>();
  const nights = new Map<string, { wins: number; losses: number }>();

  for (const match of matches) {
    const side = match.players.find((player) => player.userId === userId)?.side;
    if (!side) continue;
    for (const player of match.players) if (player.side === side && player.userId !== userId) partners.add(player.userId);
    for (const score of match.scores) {
      const mine = side === "A" ? score.sideAScore : score.sideBScore;
      const theirs = side === "A" ? score.sideBScore : score.sideAScore;
      if (mine === theirs) continue;
      const won = mine > theirs;
      if (won) { wins += 1; winMargin += mine - theirs; } else { losses += 1; lossMargin += theirs - mine; }
      conceded += theirs;
      if (Math.abs(mine - theirs) <= CLOSE_GAME_MARGIN) { closeGames += 1; if (won) closeWins += 1; }
      if (match.roundRobinId) {
        const night = nights.get(match.roundRobinId) ?? { wins: 0, losses: 0 };
        if (won) night.wins += 1; else night.losses += 1;
        nights.set(match.roundRobinId, night);
      }
    }
  }

  const games = wins + losses;
  const nicknames: Nickname[] = [];
  const percent = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`;
  if (titles >= 3) nicknames.push({ key: "titleHunter", emoji: "👑", label: "Title Hunter", reason: `${titles} round robin titles` });
  if (closeGames >= 8 && closeWins / closeGames >= 0.6) nicknames.push({ key: "closer", emoji: "🧊", label: "The Closer", reason: `Wins ${percent(closeWins, closeGames)} of games decided by ${CLOSE_GAME_MARGIN} or fewer` });
  if (ratingGain30 >= 0.25) nicknames.push({ key: "risingStar", emoji: "🚀", label: "Rising Star", reason: `Rating up ${ratingGain30.toFixed(3)} in the last 30 days` });
  if (wins >= 15 && winMargin / wins >= 6) nicknames.push({ key: "blowoutKing", emoji: "💥", label: "Blowout King", reason: `Wins by ${(winMargin / wins).toFixed(1)} points on average` });
  if (games >= 25 && conceded / games <= 7) nicknames.push({ key: "wall", emoji: "🧱", label: "The Wall", reason: `Gives up ${(conceded / games).toFixed(1)} points a game` });
  const nightList = [...nights.values()].filter((night) => night.wins + night.losses >= 3);
  const goodNights = nightList.filter((night) => night.wins >= night.losses).length;
  if (nightList.length >= 8 && goodNights / nightList.length >= 0.75) nicknames.push({ key: "consistent", emoji: "📈", label: "Mr. Consistent", reason: `At or above .500 in ${goodNights} of ${nightList.length} nights` });
  if (nights.size >= 15) nicknames.push({ key: "ironWolf", emoji: "🐺", label: "Iron Wolf", reason: `${nights.size} round robin nights played` });
  if (partners.size >= 10) nicknames.push({ key: "socialButterfly", emoji: "🦋", label: "Social Butterfly", reason: `Has partnered ${partners.size} different players` });
  // Everyday ones, so every regular has something.
  if (games >= 60) nicknames.push({ key: "grinder", emoji: "⚙️", label: "Grinder", reason: `${games} games played` });
  if (losses >= 10 && lossMargin / losses <= 4) nicknames.push({ key: "alwaysClose", emoji: "🥊", label: "Always Close", reason: `Loses by just ${(lossMargin / losses).toFixed(1)} points on average` });
  if (games >= 20 && wins / games >= 0.6) nicknames.push({ key: "sharpshooter", emoji: "🎯", label: "Sharpshooter", reason: `Wins ${percent(wins, games)} of games` });
  if (games > 0 && games < 20) nicknames.push({ key: "rookie", emoji: "🌱", label: "The Rookie", reason: `${games} game${games === 1 ? "" : "s"} in -- just getting started` });
  if (games >= 20 && !nicknames.length) nicknames.push({ key: "regular", emoji: "🐾", label: "Pack Regular", reason: `${games} games with the pack` });
  return nicknames.slice(0, NICKNAMES_SHOWN);
}
