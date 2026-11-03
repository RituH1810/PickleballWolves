import { MatchStatus, MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recentForm } from "@/lib/form";
import { goodWolfClosesAt } from "@/lib/good-wolf";
import { loadGroupFeed } from "@/lib/load-group-feed";
import { loadMonthlyStandings } from "@/lib/load-monthly-leaderboard";
import { loadTopRival } from "@/lib/load-rivalry";
import { recentMonths } from "@/lib/monthly-leaderboard";
import { mergePulse, monthlyPosition, ratingNeighbors, recentRatingChange } from "@/lib/dashboard-insights";

async function activeGroups(userId: string) {
  return prisma.membership.findMany({ where: { userId, status: MembershipStatus.ACTIVE }, select: { groupId: true, group: { select: { name: true } } } });
}

/** "Your week": rating and its change over 7 days, last five results, and the next game you've joined. */
export async function loadMyWeek(userId: string, now = new Date()) {
  const [user, rows, matches, next] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { skillRating: true } }),
    prisma.ratingHistory.findMany({ where: { userId, ladderId: null, createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } }, select: { ratingDelta: true, createdAt: true } }),
    prisma.match.findMany({ where: { status: MatchStatus.COMPLETED, deletedAt: null, players: { some: { userId } } }, orderBy: { updatedAt: "desc" }, take: 30, select: { updatedAt: true, players: { select: { userId: true, side: true } }, scores: { select: { sideAScore: true, sideBScore: true } } } }),
    prisma.roundRobinRSVP.findFirst({
      // Still counts for a few hours after it starts, while it's being played.
      where: { userId, status: "JOINED", roundRobin: { status: { not: "COMPLETED" }, scheduledAt: { gte: new Date(now.getTime() - 3 * 3_600_000) } } },
      orderBy: { roundRobin: { scheduledAt: "asc" } },
      select: { roundRobin: { select: { id: true, name: true, scheduledAt: true, group: { select: { name: true, location: true } } } } },
    }),
  ]);
  if (!user) return null;
  const form = recentForm(matches.map((match) => ({ playedAt: match.updatedAt, players: match.players, scores: match.scores })), userId);
  const game = next?.roundRobin;
  return {
    rating: Number(user.skillRating),
    weekChange: recentRatingChange(rows.map((row) => ({ ratingDelta: Number(row.ratingDelta), createdAt: row.createdAt })), now),
    form: form.results,
    streak: form.streak,
    nextGame: game ? { id: game.id, name: game.name, scheduledAt: game.scheduledAt, groupName: game.group?.name ?? null, location: game.group?.location ?? null } : null,
  };
}

export type TodoItem = { id: string; kind: "score" | "vote"; label: string; detail: string; href: string };

/** "To do": live matches you're in that still need a score, and Good Wolf votes you haven't cast. */
export async function loadTodo(userId: string, now = new Date()): Promise<TodoItem[]> {
  const unscored = await prisma.match.findMany({
    where: { deletedAt: null, scores: { none: {} }, players: { some: { userId } }, roundRobin: { status: "LIVE" } },
    orderBy: { createdAt: "asc" },
    select: { id: true, courtNumber: true, roundRobinId: true, roundRobin: { select: { name: true } }, round: { select: { roundNumber: true, stage: true } }, players: { select: { userId: true, side: true, user: { select: { name: true } } } } },
  });
  // Only rounds being played: up to the latest round with a score (round 1 before any score),
  // so a schedule's future rounds don't all show up as overdue.
  const roundRobinIds = [...new Set(unscored.map((match) => match.roundRobinId!))];
  const scoredRounds = roundRobinIds.length ? await prisma.round.findMany({ where: { roundRobinId: { in: roundRobinIds }, matches: { some: { deletedAt: null, scores: { some: {} } } } }, select: { roundRobinId: true, roundNumber: true } }) : [];
  const latestScored = new Map<string, number>();
  for (const round of scoredRounds) latestScored.set(round.roundRobinId, Math.max(latestScored.get(round.roundRobinId) ?? 0, round.roundNumber));
  const due = unscored.filter((match) => !match.round || match.round.stage || match.round.roundNumber <= Math.max(1, latestScored.get(match.roundRobinId!) ?? 0)).slice(0, 4);

  const items: TodoItem[] = due.map((match) => {
    const mySide = match.players.find((player) => player.userId === userId)?.side;
    const team = (mine: boolean) => match.players.filter((player) => (player.side === mySide) === mine).map((player) => (player.userId === userId ? "You" : player.user.name)).join(" & ");
    const stage = match.round?.stage === "FINAL" ? "Final" : match.round?.stage === "SEMIFINAL" ? "Semifinal" : match.round ? `Round ${match.round.roundNumber}` : null;
    const where = [stage, match.courtNumber ? `Court ${match.courtNumber}` : null].filter(Boolean).join(", ");
    return { id: `score:${match.id}`, kind: "score", label: `Enter your score${where ? ` · ${where}` : ""}`, detail: `${team(true)} vs ${team(false)} · ${match.roundRobin?.name ?? "Round robin"}`, href: `/round-robin/${match.roundRobinId}` };
  });

  const recent = await prisma.roundRobin.findMany({
    where: { status: "COMPLETED", completedAt: { gte: new Date(now.getTime() - 72 * 3_600_000) }, matches: { some: { deletedAt: null, scores: { some: {} }, players: { some: { userId, user: { isGuest: false } } } } } },
    select: { id: true, name: true, completedAt: true },
  });
  if (recent.length) {
    // If votes can't be read (table not created yet), don't nag about voting.
    const votes = await prisma.goodWolfVote.findMany({ where: { voterId: userId, roundRobinId: { in: recent.map((roundRobin) => roundRobin.id) } }, select: { roundRobinId: true } }).catch(() => null);
    const voted = new Set(votes ? votes.map((vote) => vote.roundRobinId) : recent.map((roundRobin) => roundRobin.id));
    for (const roundRobin of recent) {
      if (voted.has(roundRobin.id) || !roundRobin.completedAt) continue;
      const closesAt = goodWolfClosesAt(roundRobin.completedAt);
      if (closesAt <= now) continue;
      const hoursLeft = Math.max(1, Math.round((closesAt.getTime() - now.getTime()) / 3_600_000));
      items.push({ id: `vote:${roundRobin.id}`, kind: "vote", label: `Vote for ${roundRobin.name}'s Good Wolf`, detail: `Anonymous · closes in ${hoursLeft}h`, href: `/round-robin/${roundRobin.id}` });
    }
  }
  return items;
}

/** "Rival watch": who's just ahead of you by rating in your groups, your monthly board place, and your top rivalry. */
export async function loadRivalWatch(userId: string) {
  const groups = await activeGroups(userId);
  const lines: { id: string; text: string; href: string | null }[] = [];
  if (groups.length) {
    const members = await prisma.membership.findMany({ where: { groupId: { in: groups.map((group) => group.groupId) }, status: MembershipStatus.ACTIVE, user: { isGuest: false } }, select: { user: { select: { id: true, name: true, skillRating: true } } } });
    const people = [...new Map(members.map((member) => [member.user.id, { userId: member.user.id, name: member.user.name, rating: Number(member.user.skillRating) }])).values()];
    const near = ratingNeighbors(people, userId);
    if (near?.above) lines.push({ id: "rating", text: `${near.above.name} is ${near.above.gap.toFixed(3)} ahead of you in rating · you're #${near.place} of ${near.of} in your groups`, href: `/players/${near.above.userId}` });
    else if (near?.below) lines.push({ id: "rating", text: `You're the top-rated player in your groups · ${near.below.name} is ${near.below.gap.toFixed(3)} behind`, href: `/players/${near.below.userId}` });

    const [thisMonth] = recentMonths(new Date(), 1);
    const places = await Promise.all(groups.map(async (group) => {
      const [month] = await loadMonthlyStandings(group.groupId, [thisMonth]);
      const position = monthlyPosition(month.ranked, userId);
      if (!position) return null;
      const aheadName = position.ahead ? month.ranked.find((entry) => entry.userId === position.ahead!.userId)?.name ?? "Player" : null;
      return { ...position, groupId: group.groupId, groupName: group.group.name, aheadName };
    }));
    const best = places.filter((place): place is NonNullable<typeof place> => place !== null).sort((a, b) => a.rank - b.rank)[0];
    if (best) {
      const pct = (value: number) => `${Math.round(value * 100)}%`;
      const text = best.rank === 1 || !best.ahead ? `You're #${best.rank} in ${best.groupName} this month (${pct(best.winPct)})` : `You're #${best.rank} in ${best.groupName} this month · ${best.aheadName} (#${best.rank - 1}) is at ${pct(best.ahead.winPct)}, you're at ${pct(best.winPct)}`;
      lines.push({ id: "monthly", text, href: `/groups/${best.groupId}#monthly-leaderboard` });
    }
  }
  const rival = await loadTopRival(userId);
  if (rival) {
    const verdict = rival.wins === rival.losses ? "dead even, the next meeting decides it" : rival.wins > rival.losses ? "you lead" : "they lead";
    lines.push({ id: "rival", text: `Your rivalry with ${rival.name}: ${rival.wins}-${rival.losses}, ${verdict}`, href: `/rivalry/${userId}/${rival.userId}` });
  }
  return lines;
}

/** "Group pulse": the newest three activity feed moments across all your groups, with reactions. */
export async function loadGroupPulse(userId: string) {
  const groups = await activeGroups(userId);
  const feeds = await Promise.all(groups.map(async (group) => ({ group, feed: await loadGroupFeed(group.groupId, userId) })));
  return mergePulse(feeds.map(({ group, feed }) => ({
    groupId: group.groupId,
    groupName: group.group.name,
    items: feed.items.map((item) => ({ ...item, reactions: feed.reactions ? feed.reactions[item.id] ?? [] : null })),
  })));
}
