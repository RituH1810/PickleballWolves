import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ seasonId: string }> }) {
  const { seasonId } = await context.params;
  const divisions = await prisma.division.findMany({ where: { seasonId }, select: { id: true } });
  const registrations = await prisma.leagueRegistration.findMany({ where: { divisionId: { in: divisions.map((division) => division.id) } }, orderBy: { createdAt: "asc" } });
  const users = await prisma.user.findMany({ orderBy: { skillRating: "desc" }, take: 50, select: { id: true, name: true, skillRating: true } });
  return NextResponse.json({ standings: (registrations.length ? registrations.map((registration, index) => ({ rank: index + 1, userId: registration.userId, name: users.find((user) => user.id === registration.userId)?.name ?? "Player", played: 0, wins: 0, losses: 0, points: 0 })) : users.map((user, index) => ({ rank: index + 1, userId: user.id, name: user.name, played: 0, wins: 0, losses: 0, points: 0 }))) });
}
