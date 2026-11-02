import { winningSide } from "./achievements";

export const STYLE_OPTIONS = {
  side: [["LEFT", "Left side"], ["RIGHT", "Right side"], ["EITHER", "Either side"]],
  shots: [["DINKER", "Dinker"], ["BANGER", "Banger"], ["ALL_COURT", "All-court"]],
  pace: [["STEADY", "Steady"], ["AGGRESSIVE", "Aggressive"]],
} as const;

export type StyleField = keyof typeof STYLE_OPTIONS;
export type PlayStyle = Partial<Record<StyleField, string | null>>;
export const STYLE_FIELDS = Object.keys(STYLE_OPTIONS) as StyleField[];

/** Fewest games with partners of one style before it's shown. */
export const STYLE_MIN_GAMES = 5;

export const styleLabel = (field: StyleField, value: string | null | undefined) => STYLE_OPTIONS[field].find(([key]) => key === value)?.[1] ?? null;

/** Keeps only known values (anything else, or "", clears that field). */
export function cleanStyle(input: Record<string, unknown>): Record<StyleField, string | null> {
  return Object.fromEntries(STYLE_FIELDS.map((field) => {
    const value = input[field];
    return [field, typeof value === "string" && STYLE_OPTIONS[field].some(([key]) => key === value) ? value : null];
  })) as Record<StyleField, string | null>;
}

export type StyleMatch = { winnerSide: "A" | "B" | null; players: { userId: string; side: "A" | "B" }[]; scores: { gameNumber: number; sideAScore: number; sideBScore: number }[] };
export type StyleInsight = { field: StyleField; value: string; label: string; wins: number; losses: number };

/**
 * The player's record with partners of each style (a doubles match counts once for each of the
 * partner's tags), best win rate first, for styles with STYLE_MIN_GAMES+ matches.
 */
export function computeStyleInsights(matches: StyleMatch[], userId: string, styles: Map<string, PlayStyle>): StyleInsight[] {
  const tally = new Map<string, StyleInsight>();
  for (const match of matches) {
    const side = match.players.find((player) => player.userId === userId)?.side;
    const winner = winningSide(match);
    if (!side || !winner) continue;
    for (const partner of match.players.filter((player) => player.side === side && player.userId !== userId)) {
      const style = styles.get(partner.userId);
      if (!style) continue;
      for (const field of STYLE_FIELDS) {
        const label = styleLabel(field, style[field]);
        if (!label) continue;
        const key = `${field}:${style[field]}`;
        const entry = tally.get(key) ?? { field, value: style[field]!, label, wins: 0, losses: 0 };
        if (winner === side) entry.wins += 1; else entry.losses += 1;
        tally.set(key, entry);
      }
    }
  }
  const rate = (entry: StyleInsight) => entry.wins / (entry.wins + entry.losses);
  return [...tally.values()].filter((entry) => entry.wins + entry.losses >= STYLE_MIN_GAMES).sort((a, b) => rate(b) - rate(a) || b.wins + b.losses - (a.wins + a.losses));
}
