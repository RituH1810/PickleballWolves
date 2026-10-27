/** The emoji anyone can react with, in the order they're shown. */
export const REACTION_EMOJIS = ["🔥", "👏", "😮", "😂", "💪"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** What can be reacted to (see the Reaction model for each type's targetId). */
export const REACTION_TARGETS = ["ROUND_ROBIN", "PLAYER_OF_THE_WEEK", "RECORD"] as const;
export type ReactionTarget = (typeof REACTION_TARGETS)[number];

export type ReactionSummary = { emoji: ReactionEmoji; count: number; mine: boolean; names: string[] }[];

export const isReactionEmoji = (value: unknown): value is ReactionEmoji => REACTION_EMOJIS.includes(value as ReactionEmoji);
export const isReactionTarget = (value: unknown): value is ReactionTarget => REACTION_TARGETS.includes(value as ReactionTarget);

export const playerOfTheWeekTarget = (groupId: string, weekStart: string | Date) => `${groupId}:${new Date(weekStart).toISOString()}`;
export const recordTarget = (groupId: string, record: { key: string; value: string; holders: { userId: string }[] }) => `${groupId}:${record.key}:${record.value}:${record.holders.map((holder) => holder.userId).sort().join(",")}`;

/** The group a group-scoped target belongs to: everything before the first colon. Null for a round robin. */
export function reactionGroupId(targetType: ReactionTarget, targetId: string) {
  if (targetType === "ROUND_ROBIN") return null;
  const groupId = targetId.split(":")[0];
  return groupId || null;
}

/** Counts per emoji in REACTION_EMOJIS order (unused ones left out), whether the viewer used each, and who did, oldest first. */
export function summarizeReactions(rows: { userId: string; emoji: string; createdAt: Date }[], names: Map<string, string>, viewerId: string | null): ReactionSummary {
  return REACTION_EMOJIS.flatMap((emoji) => {
    const matching = rows.filter((row) => row.emoji === emoji).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return matching.length ? [{ emoji, count: matching.length, mine: matching.some((row) => row.userId === viewerId), names: matching.map((row) => names.get(row.userId) ?? "Player") }] : [];
  });
}
