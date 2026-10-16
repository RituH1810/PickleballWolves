/** One scored game from the player's point of view. */
export type TipGame = {
  playedAt: Date;
  roundRobinId: string | null;
  /** 0-based position of this game within its round robin (by when the match was created). */
  orderInSession: number;
  sessionSize: number;
  won: boolean;
  margin: number;
  partners: { userId: string; name: string }[];
  opponents: { userId: string; name: string }[];
};

export type TipInput = {
  name: string;
  games: TipGame[]; // last ~30 days
  ratingChange14d: number | null;
  lastPlayedAt: Date | null;
  nextGame: { name: string; when: string } | null;
  nearestBadge: { name: string; description: string; remaining: number; unit: string } | null;
};

export type Tip = { id: string; kind: "insight" | "general"; title: string; body: string };

// Thresholds: insights only fire on enough games to mean something.
const CLOSE_MARGIN = 2;
const BLOWOUT_MARGIN = 6;
const MIN_PAIR_GAMES = 3;
const INACTIVE_DAYS = 10;

function record(games: TipGame[]) {
  const wins = games.filter((game) => game.won).length;
  return { wins, losses: games.length - wins, pct: games.length ? wins / games.length : 0 };
}

function byPerson(games: TipGame[], pick: (game: TipGame) => { userId: string; name: string }[]) {
  const map = new Map<string, { name: string; games: TipGame[] }>();
  for (const game of games) for (const person of pick(game)) {
    const entry = map.get(person.userId) ?? { name: person.name, games: [] };
    entry.games.push(game);
    map.set(person.userId, entry);
  }
  return [...map.values()].map((entry) => ({ name: entry.name, ...record(entry.games), total: entry.games.length }));
}

/** Every performance-based tip that applies to this player right now. */
export function computeInsights(input: TipInput, now = new Date()): Tip[] {
  const tips: Tip[] = [];
  const losses = input.games.filter((game) => !game.won);

  const close = losses.filter((game) => game.margin <= CLOSE_MARGIN);
  if (close.length >= 3) tips.push({ id: "close-losses", kind: "insight", title: `${close.length} games lost by ${CLOSE_MARGIN} points or less`, body: "You're right there in those games -- the last few points decide them. At 9+, take fewer risks: aim deep and down the middle on serves and returns, reset to the kitchen instead of speeding up a ball above net height, and let your opponents make the error." });

  const blowouts = losses.filter((game) => game.margin >= BLOWOUT_MARGIN);
  if (blowouts.length >= 3) tips.push({ id: "blowout-losses", kind: "insight", title: `${blowouts.length} games lost by ${BLOWOUT_MARGIN}+ this month`, body: "When a game gets away from you, it's usually the opponents controlling the kitchen. Get to the line after your return, slow the point down with soft dinks to their backhand, and drill the reset: block hard drives softly back into the kitchen." });

  const partners = byPerson(input.games, (game) => game.partners).filter((entry) => entry.total >= MIN_PAIR_GAMES);
  if (partners.length >= 2) {
    const sorted = [...partners].sort((a, b) => b.pct - a.pct);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best.pct - worst.pct >= 0.4) tips.push({ id: "partner-gap", kind: "insight", title: `${best.wins}-${best.losses} with ${best.name}, ${worst.wins}-${worst.losses} with ${worst.name}`, body: `Chemistry matters. Before your next game with ${worst.name.split(" ")[0]}, agree on two things: who takes balls down the middle (usually the forehand) and when you both move up together. Call "yours"/"mine" early and loudly.` });
  }

  const nemesis = byPerson(input.games, (game) => game.opponents).filter((entry) => entry.total >= 4 && entry.pct <= 0.25).sort((a, b) => a.pct - b.pct || b.total - a.total)[0];
  if (nemesis) tips.push({ id: "nemesis", kind: "insight", title: `${nemesis.name} has your number: ${nemesis.wins}-${nemesis.losses}`, body: `Next time you face ${nemesis.name.split(" ")[0]}, watch their first few points: do they prefer to drive or drop, and which side is weaker? Keep the ball away from their strength and test their backhand with dinks and lobs when they crowd the line.` });

  // Within round robin nights: early games vs late games.
  const sessions = input.games.filter((game) => game.roundRobinId && game.sessionSize >= 4);
  if (sessions.length >= 8) {
    const early = record(sessions.filter((game) => game.orderInSession < game.sessionSize / 2));
    const late = record(sessions.filter((game) => game.orderInSession >= game.sessionSize / 2));
    if (early.pct - late.pct >= 0.25) tips.push({ id: "late-fade", kind: "insight", title: `You win ${Math.round(early.pct * 100)}% early in the night, ${Math.round(late.pct * 100)}% late`, body: "Your later games are where the points are leaking. Bring water and a snack, keep moving between games instead of sitting down cold, and shorten your backswing when your legs get tired -- compact strokes hold up better." });
    else if (late.pct - early.pct >= 0.25) tips.push({ id: "slow-start", kind: "insight", title: `You win ${Math.round(late.pct * 100)}% late in the night but ${Math.round(early.pct * 100)}% early`, body: "You warm into it -- so warm up before the first game. Five minutes of dinking and a few volleys and drops before you start can turn those early losses around." });
  }

  if (input.ratingChange14d !== null && input.ratingChange14d <= -0.2) tips.push({ id: "rating-down", kind: "insight", title: `Rating down ${Math.abs(input.ratingChange14d).toFixed(2)} in two weeks`, body: "Dips happen. Most rec games are lost on unforced errors, not winners: for your next session, aim every shot a foot inside the lines and only attack balls above the net. Fewer mistakes beats more power." });
  if (input.ratingChange14d !== null && input.ratingChange14d >= 0.2) tips.push({ id: "rating-up", kind: "insight", title: `Rating up ${input.ratingChange14d.toFixed(2)} in two weeks`, body: "Whatever you're doing, it's working. Keep the momentum by asking to play with or against someone rated higher -- that's where the next jump comes from." });

  let streak = 0;
  for (const game of [...input.games].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())) { if (!game.won) break; streak += 1; }
  if (streak >= 3) tips.push({ id: "streak", kind: "insight", title: `${streak} wins in a row`, body: "You're on a roll. Don't change what's working -- same warm-up, same partner talk, same targets. And when you do lose one, reset; streaks end, form doesn't." });

  if (input.lastPlayedAt && now.getTime() - input.lastPlayedAt.getTime() > INACTIVE_DAYS * 86_400_000) {
    const days = Math.floor((now.getTime() - input.lastPlayedAt.getTime()) / 86_400_000);
    tips.push({ id: "inactive", kind: "insight", title: `${days} days since your last game`, body: input.nextGame ? `${input.nextGame.name} is coming up ${input.nextGame.when} -- jump in. After a break, ease in with dinks and drops before you start driving.` : "Get back on court this week -- check Invites for a game. After a break, ease in with dinks and drops before you start driving." });
  }

  if (input.nearestBadge) tips.push({ id: "next-badge", kind: "insight", title: `${input.nearestBadge.remaining} ${input.nearestBadge.unit} to ${input.nearestBadge.name}`, body: `${input.nearestBadge.description} You're close -- it'll show up on your profile the moment you get there.` });

  return tips;
}

export const GENERAL_TIPS: Tip[] = [
  { id: "g-third-shot", title: "Master the third-shot drop", body: "After the return, a soft drop into the kitchen buys your team time to get to the net. Lift from the shoulder, not the wrist, and aim for the opponents' feet." },
  { id: "g-return-deep", title: "Return deep, then move up", body: "A deep return pins the serving team back and gives you time to reach the kitchen line. Height over the net is fine -- depth is what matters." },
  { id: "g-ready-position", title: "Paddle up, always", body: "Keep your paddle out in front at chest height between shots. Most missed volleys come from a paddle that dropped to your knees." },
  { id: "g-middle", title: "When in doubt, go middle", body: "A ball down the middle causes hesitation between partners and takes away sharp angles. It's the safest target in doubles." },
  { id: "g-dink-patience", title: "Win the dink battle with patience", body: "Don't speed up a dink unless it's above the net. Keep it low and cross-court, and wait for the high ball -- it always comes." },
  { id: "g-reset", title: "Practice the reset", body: "When you're hit at in transition, soften your grip and block the ball back into the kitchen. A good reset turns defense back into neutral." },
  { id: "g-communicate", title: "Talk on every ball", body: "\"Yours,\" \"mine,\" \"bounce\" -- quick calls prevent the two most common doubles mistakes: both going for it or both leaving it." },
  { id: "g-serve-deep", title: "Serve deep and steady", body: "You can't win points while serving if you miss serves. Aim deep to the backhand side and take pace off -- a consistent serve beats a flashy one." },
  { id: "g-split-step", title: "Split-step as they hit", body: "A small hop as your opponent makes contact gets you balanced and ready to move either way. It's the cheapest speed you'll ever add." },
  { id: "g-lob-smart", title: "Lob with a purpose", body: "Lob when opponents are leaning in and crowding the line, and aim over the backhand shoulder. A short lob is a gift -- go high and deep or don't go." },
  { id: "g-stack", title: "Try stacking", body: "Stacking lets both partners stay on their stronger side every point. Ask your partner to try it for one game and see who covers the middle." },
  { id: "g-warm-up", title: "Warm up before game one", body: "Five minutes of dinks, volleys, and drops before the first game cuts early unforced errors and protects your shoulder and calves." },
  { id: "g-erne", title: "Watch the sidelines", body: "When an opponent dinks wide down your sideline, they open up an around-the-post or Erne chance -- and if you dink wide, watch for theirs." },
  { id: "g-score", title: "Call the score loudly", body: "Calling the score clearly before every serve avoids arguments and keeps your team focused on the next point, not the last one." },
].map((tip) => ({ ...tip, kind: "general" as const }));

function dayNumber(dateKey: string) {
  return Math.floor(Date.UTC(Number(dateKey.slice(0, 4)), Number(dateKey.slice(5, 7)) - 1, Number(dateKey.slice(8, 10))) / 86_400_000);
}

/**
 * Today's tip: the player's insights plus one general tip, rotated by day so it changes daily and
 * every insight gets its turn. Same answer all day for the same player; `seed` (e.g. derived from
 * their id) staggers the rotation so a whole group doesn't get the same kind of tip on one day.
 */
export function pickDailyTip(insights: Tip[], dateKey: string, seed = 0): Tip {
  const day = dayNumber(dateKey) + seed;
  const general = GENERAL_TIPS[day % GENERAL_TIPS.length];
  const candidates = [...insights, general];
  return candidates[day % candidates.length];
}
