import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Round robins should stay visible for the whole day they're scheduled on, not vanish the
  // instant their start time passes (they may still be live), and only drop off starting the
  // next calendar day -- unless already COMPLETED, which hides them immediately regardless.
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const myGroupIds = user ? (await prisma.membership.findMany({ where: { userId: user.id, status: MembershipStatus.ACTIVE }, select: { groupId: true } })).map((membership) => membership.groupId) : [];
  const [events, groups] = await Promise.all([
    prisma.event.findMany({ where: { status: "PUBLISHED", startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 6, include: { group: true, rsvps: { select: { userId: true, status: true } } } }),
    // "Your groups" -- scope to the groups this user has actually joined, not every public group.
    myGroupIds.length ? prisma.group.findMany({
      where: { id: { in: myGroupIds } },
      orderBy: { createdAt: "asc" },
      take: 6,
      include: {
        _count: { select: { memberships: { where: { status: MembershipStatus.ACTIVE } } } },
        events: { where: { status: "PUBLISHED", startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 1, select: { title: true, startsAt: true } },
        roundRobins: { where: { status: { in: ["SETUP", "LIVE"] }, OR: [{ scheduledAt: null }, { scheduledAt: { gte: startOfToday } }] }, orderBy: { scheduledAt: "asc" }, take: 1, select: { name: true, scheduledAt: true } },
      },
    }) : Promise.resolve([]),
  ]);

  let pendingRoundRobins: { id: string; name: string; groupName: string; organizerName: string; playFormat: string; partnerFormat: string; joinedCount: number; scheduledAt: Date | null }[] = [];
  let myRoundRobins: { id: string; name: string; groupName: string | null; playFormat: string; partnerFormat: string; status: string; scheduledAt: Date | null; isOrganizer: boolean; myRsvpStatus: "JOINED" | "DECLINED" | null }[] = [];
  if (user) {
    const myLiveRoundRobins = await prisma.roundRobin.findMany({
      where: {
        status: { in: ["SETUP", "LIVE"] },
        AND: [
          { OR: [{ createdById: user.id }, { rsvps: { some: { userId: user.id, status: "JOINED" } } }] },
          { OR: [{ scheduledAt: null }, { scheduledAt: { gte: startOfToday } }] },
        ],
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      take: 8,
      include: { group: { select: { name: true } }, rsvps: { where: { userId: user.id } } },
    });
    myRoundRobins = myLiveRoundRobins.map((roundRobin) => ({
      id: roundRobin.id,
      name: roundRobin.name,
      groupName: roundRobin.group?.name ?? null,
      playFormat: roundRobin.playFormat,
      partnerFormat: roundRobin.partnerFormat,
      status: roundRobin.status,
      scheduledAt: roundRobin.scheduledAt,
      isOrganizer: roundRobin.createdById === user.id,
      myRsvpStatus: roundRobin.rsvps[0]?.status ?? null,
    }));

    if (myGroupIds.length) {
      const roundRobins = await prisma.roundRobin.findMany({
        where: { groupId: { in: myGroupIds }, status: { in: ["SETUP", "LIVE"] }, OR: [{ scheduledAt: null }, { scheduledAt: { gte: startOfToday } }] },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
        include: { group: { select: { name: true } }, rsvps: true },
      });
      // Once a member has responded (joined or declined), it's no longer a pending invite for them.
      const unanswered = roundRobins.filter((roundRobin) => !roundRobin.rsvps.some((rsvp) => rsvp.userId === user.id));
      const organizerIds = [...new Set(unanswered.map((roundRobin) => roundRobin.createdById))];
      const organizers = await prisma.user.findMany({ where: { id: { in: organizerIds } }, select: { id: true, name: true } });
      const organizerNameById = new Map(organizers.map((organizer) => [organizer.id, organizer.name]));
      pendingRoundRobins = unanswered.map((roundRobin) => ({
        id: roundRobin.id,
        name: roundRobin.name,
        groupName: roundRobin.group?.name ?? "Group",
        organizerName: organizerNameById.get(roundRobin.createdById) ?? "Unknown",
        playFormat: roundRobin.playFormat,
        partnerFormat: roundRobin.partnerFormat,
        joinedCount: roundRobin.rsvps.filter((rsvp) => rsvp.status === "JOINED").length,
        scheduledAt: roundRobin.scheduledAt,
      }));
    }
  }

  return NextResponse.json({ userId: user?.id ?? null, events: events.map((event) => ({ id: event.id, title: event.title, startsAt: event.startsAt, dateLabel: event.startsAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), timeLabel: event.startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }), location: event.location, format: event.format === "MIXED" ? "Mixed doubles" : event.format.charAt(0) + event.format.slice(1).toLowerCase(), spotsLeft: Math.max(0, event.playerCap - event.rsvps.filter((rsvp) => rsvp.status === "GOING").length), totalSpots: event.playerCap, group: event.group?.name ?? "Open play", accent: "lime", attending: user ? event.rsvps.some((rsvp) => rsvp.userId === user.id && rsvp.status === "GOING") : false })), groups: groups.map((group) => {
    // "Next up" for a group can come from either an event or a round robin -- whichever is soonest.
    const nextEvent = group.events[0];
    const nextRoundRobin = group.roundRobins[0];
    let next = "No upcoming games";
    if (nextEvent && nextRoundRobin) next = (nextRoundRobin.scheduledAt && nextEvent.startsAt <= nextRoundRobin.scheduledAt) ? nextEvent.title : nextRoundRobin.name;
    else if (nextEvent) next = nextEvent.title;
    else if (nextRoundRobin) next = nextRoundRobin.name;
    return { id: group.id, name: group.name, location: group.location, members: group._count.memberships, next, role: "Member", mark: group.name.split(" ").map((word) => word[0]).join("").slice(0, 2), color: "lime" };
  }), pendingRoundRobins, myRoundRobins });
}
