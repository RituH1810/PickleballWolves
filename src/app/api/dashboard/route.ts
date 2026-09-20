import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [events, groups] = await Promise.all([
    prisma.event.findMany({ where: { status: "PUBLISHED", startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 6, include: { group: true, rsvps: { select: { userId: true, status: true } } } }),
    prisma.group.findMany({ where: { visibility: "PUBLIC" }, orderBy: { createdAt: "asc" }, take: 6, include: { _count: { select: { memberships: true } }, events: { where: { status: "PUBLISHED" }, orderBy: { startsAt: "asc" }, take: 1, select: { title: true } } } }),
  ]);
  return NextResponse.json({ userId: user?.id ?? null, events: events.map((event) => ({ id: event.id, title: event.title, dateLabel: event.startsAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), timeLabel: event.startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }), location: event.location, format: event.format === "MIXED" ? "Mixed doubles" : event.format.charAt(0) + event.format.slice(1).toLowerCase(), spotsLeft: Math.max(0, event.playerCap - event.rsvps.filter((rsvp) => rsvp.status === "GOING").length), totalSpots: event.playerCap, group: event.group?.name ?? "Open play", accent: "lime", attending: user ? event.rsvps.some((rsvp) => rsvp.userId === user.id && rsvp.status === "GOING") : false })), groups: groups.map((group) => ({ id: group.id, name: group.name, location: group.location, members: group._count.memberships, next: group.events[0]?.title ?? "No upcoming games", role: "Member", mark: group.name.split(" ").map((word) => word[0]).join("").slice(0, 2), color: "lime" })) });
}
