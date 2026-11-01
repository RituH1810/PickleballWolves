import { MatchStatus, MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeWinStreaks } from "@/lib/win-streak";

/**
 * A player's best and current win streaks. With a viewerId, also the matches in the best streak
 * (date, partner, opponents, score and where it was played), oldest first; a game from a private
 * group the viewer isn't in shows no group or round robin name.
 */
export async function loadWinStreak(userId: string, viewerId: string | null) {
  const matches = await prisma.match.findMany({
    where: { status: MatchStatus.COMPLETED, deletedAt: null, players: { some: { userId } } },
    select: { id: true, updatedAt: true, winnerSide: true, players: { select: { userId: true, side: true } }, scores: { select: { gameNumber: true, sideAScore: true, sideBScore: true } } },
  });
  const streaks = computeWinStreaks(matches.map((match) => ({ ...match, playedAt: match.updatedAt })), userId);
  if (!viewerId || !streaks.best.length) return { best: streaks.best.length, current: streaks.current, matches: [] };

  const details = await prisma.match.findMany({
    where: { id: { in: streaks.best.matchIds } },
    select: {
      id: true,
      updatedAt: true,
      players: { select: { userId: true, side: true, user: { select: { name: true } } } },
      scores: { orderBy: { gameNumber: "asc" }, select: { sideAScore: true, sideBScore: true } },
      roundRobin: { select: { id: true, name: true, group: { select: { id: true, visibility: true } } } },
      event: { select: { title: true, group: { select: { id: true, visibility: true } } } },
      tournamentGroup: { select: { tournament: { select: { id: true, name: true } } } },
      bracketMatch: { select: { tournament: { select: { id: true, name: true } } } },
    },
  });
  const groupIds = [...new Set(details.flatMap((match) => [match.roundRobin?.group, match.event?.group].flatMap((group) => (group ? [group.id] : []))))];
  const myGroups = viewerId === userId ? null : new Set((await prisma.membership.findMany({ where: { userId: viewerId, status: MembershipStatus.ACTIVE, groupId: { in: groupIds } }, select: { groupId: true } })).map((membership) => membership.groupId));
  const canSee = (group: { id: string; visibility: string } | null | undefined) => !group || !myGroups || group.visibility === "PUBLIC" || myGroups.has(group.id);

  const order = new Map(streaks.best.matchIds.map((id, index) => [id, index]));
  return {
    best: streaks.best.length,
    current: streaks.current,
    matches: details.sort((a, b) => order.get(a.id)! - order.get(b.id)!).map((match) => {
      const mySide = match.players.find((player) => player.userId === userId)!.side;
      const tournament = match.bracketMatch?.tournament ?? match.tournamentGroup?.tournament ?? null;
      const where = tournament ? { label: tournament.name, href: `/tournaments/${tournament.id}` }
        : match.roundRobin ? (canSee(match.roundRobin.group) ? { label: match.roundRobin.name, href: `/round-robin/${match.roundRobin.id}` } : { label: "Group round robin", href: null })
        : match.event ? { label: canSee(match.event.group) ? match.event.title : "Group game", href: null }
        : { label: "Recorded match", href: null };
      return {
        id: match.id,
        playedAt: match.updatedAt,
        partners: match.players.filter((player) => player.side === mySide && player.userId !== userId).map((player) => player.user.name),
        opponents: match.players.filter((player) => player.side !== mySide).map((player) => player.user.name),
        scores: match.scores.map((score) => (mySide === "A" ? [score.sideAScore, score.sideBScore] : [score.sideBScore, score.sideAScore])),
        where,
      };
    }),
  };
}
