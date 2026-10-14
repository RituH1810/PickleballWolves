import { NextResponse } from "next/server";
import { MembershipStatus, RsvpStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

type InviteKind = "event" | "roundRobin" | "challenge";
type Invite = { id: string; kind: InviteKind; startsAt: string | null; title: string; subtitle: string; count: number; cap: number | null; hostName: string; hostPhotoUrl: string | null; detailsHref: string; deadlineAt?: string };
type JoinRequest = { groupId: string; groupName: string; userId: string; name: string; photoUrl: string | null; skillRating: string };

/**
 * Everything waiting on the signed-in player's response, for the notifications inbox:
 * - invites: upcoming group events and round robins they haven't RSVP'd to, plus pending ladder challenges
 * - requests: pending join requests for groups they're an active member of (any active member can approve)
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ invites: [], requests: [] });

  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const myGroupIds = (await prisma.membership.findMany({ where: { userId: user.id, status: MembershipStatus.ACTIVE }, select: { groupId: true } })).map((membership) => membership.groupId);

  const [events, roundRobins, challenges, pendingMemberships] = await Promise.all([
    myGroupIds.length ? prisma.event.findMany({
      where: { groupId: { in: myGroupIds }, status: "PUBLISHED", startsAt: { gte: now }, createdById: { not: user.id }, rsvps: { none: { userId: user.id } } },
      orderBy: { startsAt: "asc" },
      include: { group: { select: { name: true, logoUrl: true } }, createdBy: { select: { name: true, photoUrl: true } }, rsvps: { where: { status: RsvpStatus.GOING }, select: { id: true } } },
    }) : Promise.resolve([]),
    myGroupIds.length ? prisma.roundRobin.findMany({
      where: { groupId: { in: myGroupIds }, status: { in: ["SETUP", "LIVE"] }, createdById: { not: user.id }, rsvps: { none: { userId: user.id } }, OR: [{ scheduledAt: null }, { scheduledAt: { gte: startOfToday } }] },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      include: { group: { select: { name: true } }, rsvps: { where: { status: "JOINED" }, select: { id: true } } },
    }) : Promise.resolve([]),
    prisma.challenge.findMany({ where: { challengedId: user.id, status: "PENDING", deadlineAt: { gt: now } }, orderBy: { deadlineAt: "asc" } }),
    myGroupIds.length ? prisma.membership.findMany({
      where: { groupId: { in: myGroupIds }, status: MembershipStatus.PENDING },
      include: { group: { select: { name: true } }, user: { select: { id: true, name: true, photoUrl: true, skillRating: true } } },
    }) : Promise.resolve([]),
  ]);

  // RoundRobin and Challenge store user/ladder ids without relations, so resolve names in one batch.
  const userIds = [...new Set([...roundRobins.map((roundRobin) => roundRobin.createdById), ...challenges.map((challenge) => challenge.challengerId)])];
  const ladderIds = [...new Set(challenges.map((challenge) => challenge.ladderId))];
  const [people, ladders] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, photoUrl: true } }) : Promise.resolve([]),
    ladderIds.length ? prisma.ladder.findMany({ where: { id: { in: ladderIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const personById = new Map(people.map((person) => [person.id, person]));
  const ladderNameById = new Map(ladders.map((ladder) => [ladder.id, ladder.name]));

  const invites: Invite[] = [
    ...events.map((event): Invite => ({
      id: event.id,
      kind: "event",
      startsAt: event.startsAt.toISOString(),
      title: event.group ? `${event.group.name} - ${event.title}` : event.title,
      subtitle: event.location,
      count: event.rsvps.length,
      cap: event.playerCap,
      hostName: event.createdBy.name,
      hostPhotoUrl: event.createdBy.photoUrl ?? event.group?.logoUrl ?? null,
      detailsHref: event.groupId ? `/groups/${event.groupId}` : "/events",
    })),
    ...roundRobins.map((roundRobin): Invite => ({
      id: roundRobin.id,
      kind: "roundRobin",
      startsAt: roundRobin.scheduledAt?.toISOString() ?? null,
      title: roundRobin.group ? `${roundRobin.group.name} - ${roundRobin.name}` : roundRobin.name,
      subtitle: `Round robin · ${roundRobin.courtCount} court${roundRobin.courtCount === 1 ? "" : "s"}`,
      count: roundRobin.rsvps.length,
      cap: null,
      hostName: personById.get(roundRobin.createdById)?.name ?? "Organizer",
      hostPhotoUrl: personById.get(roundRobin.createdById)?.photoUrl ?? null,
      detailsHref: `/round-robin/${roundRobin.id}`,
    })),
    ...challenges.map((challenge): Invite => ({
      id: challenge.id,
      kind: "challenge",
      startsAt: null,
      title: `${personById.get(challenge.challengerId)?.name ?? "A player"} challenged you`,
      subtitle: `${ladderNameById.get(challenge.ladderId) ?? "Ladder"} ladder`,
      deadlineAt: challenge.deadlineAt.toISOString(),
      count: 2,
      cap: 2,
      hostName: personById.get(challenge.challengerId)?.name ?? "Player",
      hostPhotoUrl: personById.get(challenge.challengerId)?.photoUrl ?? null,
      detailsHref: "/ladder",
    })),
  ];
  // Soonest first; undated items (unscheduled round robins, challenges) after the dated ones.
  invites.sort((a, b) => (a.startsAt ? Date.parse(a.startsAt) : Infinity) - (b.startsAt ? Date.parse(b.startsAt) : Infinity));

  const requests: JoinRequest[] = pendingMemberships
    .filter((membership) => membership.userId !== user.id)
    .map((membership) => ({ groupId: membership.groupId, groupName: membership.group.name, userId: membership.user.id, name: membership.user.name, photoUrl: membership.user.photoUrl, skillRating: membership.user.skillRating.toString() }));

  return NextResponse.json({ invites, requests });
}
