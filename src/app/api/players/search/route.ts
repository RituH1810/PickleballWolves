import { NextResponse } from "next/server";
import { MatchStatus, MembershipStatus, type Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { buildLeaderboard } from "@/lib/leaderboard";

const RESULT_LIMIT = 50;

/**
 * Player directory. Filters: q (name), court (home court), minRating / maxRating, groupId (one of
 * the viewer's own groups), sort = name | rating | matches. Only public profile fields come back.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  const court = params.get("court")?.trim() ?? "";
  const minRating = params.get("minRating") ? Number(params.get("minRating")) : NaN;
  const maxRating = params.get("maxRating") ? Number(params.get("maxRating")) : NaN;
  const groupId = params.get("groupId") || null;
  const sort = params.get("sort") ?? "name";

  const myGroups = await prisma.group.findMany({ where: { memberships: { some: { userId: user.id, status: MembershipStatus.ACTIVE } } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  // Only filter by groups the viewer belongs to, so this can't be used to list a private group's roster.
  if (groupId && !myGroups.some((group) => group.id === groupId)) return NextResponse.json({ error: "You can only filter by your own groups." }, { status: 403 });

  const rating: Prisma.DecimalFilter<"User"> = {};
  if (Number.isFinite(minRating)) rating.gte = minRating;
  if (Number.isFinite(maxRating)) rating.lte = maxRating;
  const where: Prisma.UserWhereInput = {
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    ...(court ? { homeCourt: { contains: court, mode: "insensitive" } } : {}),
    ...(Object.keys(rating).length ? { skillRating: rating } : {}),
    ...(groupId ? { memberships: { some: { groupId, status: MembershipStatus.ACTIVE } } } : {}),
  };

  const [players, total, leaderboard] = await Promise.all([
    prisma.user.findMany({ where, select: { id: true, name: true, photoUrl: true, skillRating: true, homeCourt: true } }),
    prisma.user.count({ where }),
    buildLeaderboard(),
  ]);
  const counts = await prisma.matchPlayer.groupBy({ by: ["userId"], where: { userId: { in: players.map((player) => player.id) }, match: { status: MatchStatus.COMPLETED, deletedAt: null } }, _count: { _all: true } });
  const matchesById = new Map(counts.map((row) => [row.userId, row._count._all]));
  const rankById = new Map(leaderboard.map((entry) => [entry.id, entry.rank]));

  const results = players
    .map((player) => ({ id: player.id, name: player.name, photoUrl: player.photoUrl, homeCourt: player.homeCourt, skillRating: Number(player.skillRating), matches: matchesById.get(player.id) ?? 0, rank: rankById.get(player.id) ?? null, isMe: player.id === user.id }))
    .sort((a, b) => sort === "rating" ? b.skillRating - a.skillRating || a.name.localeCompare(b.name) : sort === "matches" ? b.matches - a.matches || a.name.localeCompare(b.name) : a.name.localeCompare(b.name))
    .slice(0, RESULT_LIMIT);

  return NextResponse.json({ players: results, total, groups: myGroups });
}
