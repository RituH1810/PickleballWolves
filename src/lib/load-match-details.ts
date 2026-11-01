import { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type MatchDetail = { id: string; playedAt: Date; partners: string[]; opponents: string[]; scores: [number, number][]; where: { label: string; href: string | null } };

/**
 * Matches as `userId` played them, in the order of `matchIds`: date, partner(s), opponents, score
 * from their side, and where it was played. A game from a private group `viewerId` isn't in shows
 * no group or round robin name.
 */
export async function loadMatchDetails(matchIds: string[], userId: string, viewerId: string): Promise<MatchDetail[]> {
  if (!matchIds.length) return [];
  const details = await prisma.match.findMany({
    where: { id: { in: matchIds } },
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

  const order = new Map(matchIds.map((id, index) => [id, index]));
  return details.sort((a, b) => order.get(a.id)! - order.get(b.id)!).flatMap((match) => {
    const mySide = match.players.find((player) => player.userId === userId)?.side;
    if (!mySide) return [];
    const tournament = match.bracketMatch?.tournament ?? match.tournamentGroup?.tournament ?? null;
    const where = tournament ? { label: tournament.name, href: `/tournaments/${tournament.id}` }
      : match.roundRobin ? (canSee(match.roundRobin.group) ? { label: match.roundRobin.name, href: `/round-robin/${match.roundRobin.id}` } : { label: "Group round robin", href: null })
      : match.event ? { label: canSee(match.event.group) ? match.event.title : "Group game", href: null }
      : { label: "Recorded match", href: null };
    return [{
      id: match.id,
      playedAt: match.updatedAt,
      partners: match.players.filter((player) => player.side === mySide && player.userId !== userId).map((player) => player.user.name),
      opponents: match.players.filter((player) => player.side !== mySide).map((player) => player.user.name),
      scores: match.scores.map((score): [number, number] => (mySide === "A" ? [score.sideAScore, score.sideBScore] : [score.sideBScore, score.sideAScore])),
      where,
    }];
  });
}
