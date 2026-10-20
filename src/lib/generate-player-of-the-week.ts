import { MatchStatus, MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { pickPlayerOfTheWeek, previousWeek, WEEKLY_MIN_MATCHES } from "@/lib/player-of-the-week";

/**
 * Chooses and announces every group's Player of the Week for the week that just ended: saves the
 * winner(s), posts a group announcement, and notifies members (winners get their own message).
 * Groups already decided for that week are skipped, so re-runs never double-announce.
 */
export async function generatePlayerOfTheWeek(week = previousWeek()) {
  const groups = await prisma.group.findMany({ select: { id: true, name: true, createdById: true } });
  const results: { group: string; winners: string[] }[] = [];

  for (const group of groups) {
    if (await prisma.playerOfTheWeek.count({ where: { groupId: group.id, weekStart: week.start } })) continue;
    const [members, matches] = await Promise.all([
      prisma.membership.findMany({ where: { groupId: group.id, status: MembershipStatus.ACTIVE }, select: { userId: true, user: { select: { name: true } } } }),
      prisma.match.findMany({
        where: { status: MatchStatus.COMPLETED, deletedAt: null, roundRobin: { groupId: group.id }, updatedAt: { gte: week.start, lt: week.end }, scores: { some: {} } },
        select: { updatedAt: true, players: { select: { userId: true, side: true } }, scores: { select: { sideAScore: true, sideBScore: true } } },
      }),
    ]);
    const winners = pickPlayerOfTheWeek(matches.map((match) => ({ playedAt: match.updatedAt, players: match.players, scores: match.scores })), new Set(members.map((member) => member.userId)));
    if (!winners.length) continue;

    const saved = await prisma.playerOfTheWeek.createMany({ data: winners.map((winner) => ({ groupId: group.id, weekStart: week.start, userId: winner.userId, matches: winner.matches, wins: winner.wins, losses: winner.losses, avgPointDiff: winner.avgPointDiff })), skipDuplicates: true });
    if (!saved.count) continue;

    const nameOf = new Map(members.map((member) => [member.userId, member.user.name]));
    const line = (winner: (typeof winners)[number]) => `${nameOf.get(winner.userId) ?? "Player"} -- ${winner.wins}-${winner.losses} in ${winner.matches} matches (${Math.round(winner.winPct * 100)}%, ${winner.avgPointDiff > 0 ? "+" : ""}${winner.avgPointDiff} avg)`;
    const title = `Player of the Week: ${winners.map((winner) => nameOf.get(winner.userId) ?? "Player").join(" & ")}`;
    const body = `${week.label}\n${winners.map(line).join("\n")}\n\nBest win % with ${WEEKLY_MIN_MATCHES}+ matches in the group this week. Congrats!`;
    await prisma.announcement.create({ data: { groupId: group.id, authorId: group.createdById, title, body } });
    const winnerIds = new Set(winners.map((winner) => winner.userId));
    await Promise.all(members.map((member) => winnerIds.has(member.userId)
      ? notify(member.userId, "general", "PLAYER_OF_THE_WEEK", "You're Player of the Week!", `${group.name}, ${week.label}: ${line(winners.find((winner) => winner.userId === member.userId)!).split(" -- ")[1]}. It's on your profile.`, `/groups/${group.id}#player-of-the-week`)
      : notify(member.userId, "general", "PLAYER_OF_THE_WEEK", `${group.name}: ${title}`, `${week.label} -- ${winners.map(line).join("; ")}`, `/groups/${group.id}#player-of-the-week`)));
    results.push({ group: group.name, winners: winners.map((winner) => nameOf.get(winner.userId) ?? winner.userId) });
  }
  return { week: week.label, results };
}
