import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ sent: [], received: [] });
  const challenges = await prisma.challenge.findMany({ where: { OR: [{ challengerId: user.id }, { challengedId: user.id }] }, orderBy: { createdAt: "desc" }, take: 30 });
  const userIds = [...new Set(challenges.flatMap((challenge) => [challenge.challengerId, challenge.challengedId]))];
  const ladderIds = [...new Set(challenges.map((challenge) => challenge.ladderId))];
  const matchIds = challenges.map((challenge) => challenge.matchId).filter((id): id is string => Boolean(id));
  const [users, ladders, matches] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
    prisma.ladder.findMany({ where: { id: { in: ladderIds } }, select: { id: true, name: true } }),
    matchIds.length ? prisma.match.findMany({ where: { id: { in: matchIds } }, select: { id: true, status: true } }) : Promise.resolve([]),
  ]);
  const nameById = new Map(users.map((candidate) => [candidate.id, candidate.name]));
  const ladderNameById = new Map(ladders.map((ladder) => [ladder.id, ladder.name]));
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const shape = (challenge: typeof challenges[number]) => ({
    id: challenge.id,
    ladderId: challenge.ladderId,
    ladderName: ladderNameById.get(challenge.ladderId) ?? "Ladder",
    challengerId: challenge.challengerId,
    challengerName: nameById.get(challenge.challengerId) ?? "Player",
    challengedId: challenge.challengedId,
    challengedName: nameById.get(challenge.challengedId) ?? "Player",
    status: challenge.status,
    deadlineAt: challenge.deadlineAt,
    createdAt: challenge.createdAt,
    matchId: challenge.matchId,
    matchStatus: challenge.matchId ? matchById.get(challenge.matchId)?.status ?? null : null,
  });
  return NextResponse.json({
    sent: challenges.filter((challenge) => challenge.challengerId === user.id).map(shape),
    received: challenges.filter((challenge) => challenge.challengedId === user.id).map(shape),
  });
}
