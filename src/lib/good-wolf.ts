// The Good Wolf: after a round robin ends, its players anonymously vote for whoever showed the best
// sportsmanship. Only the result is ever shown -- never who voted, or for whom.

/** How long voting stays open after a round robin ends. */
export const GOOD_WOLF_VOTE_HOURS = 72;
/** Votes the winner needs, so one vote alone doesn't crown anyone. */
export const GOOD_WOLF_MIN_VOTES = 2;

export const goodWolfClosesAt = (endedAt: Date) => new Date(endedAt.getTime() + GOOD_WOLF_VOTE_HOURS * 3_600_000);

/**
 * Whether voting is still open and, once it's closed, the winners: the most votes (at least
 * GOOD_WOLF_MIN_VOTES), ties shared. No per-player tally is returned, so nobody can work out votes.
 */
export function goodWolfResult(nomineeIds: string[], endedAt: Date, now: Date) {
  const closesAt = goodWolfClosesAt(endedAt);
  if (now < closesAt) return { open: true, closesAt, totalVotes: nomineeIds.length, winners: [] as { userId: string; votes: number }[] };
  const counts = new Map<string, number>();
  for (const id of nomineeIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const top = Math.max(0, ...counts.values());
  const winners = top >= GOOD_WOLF_MIN_VOTES ? [...counts].filter(([, votes]) => votes === top).map(([userId, votes]) => ({ userId, votes })) : [];
  return { open: false, closesAt, totalVotes: nomineeIds.length, winners };
}
