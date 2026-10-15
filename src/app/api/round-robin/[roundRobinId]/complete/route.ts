import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { loadRecap } from "@/lib/load-recap";

export async function POST(_request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to end this round robin." }, { status: 401 });
  const { roundRobinId } = await context.params;
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId } });
  if (!roundRobin) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  if (roundRobin.createdById !== user.id) return NextResponse.json({ error: "Only the round robin organizer can end it." }, { status: 403 });
  const updated = await prisma.roundRobin.update({ where: { id: roundRobinId }, data: { status: "COMPLETED", completedAt: new Date() } });
  // Send everyone who played the headline result; the full recap is on the round robin page.
  if (roundRobin.status !== "COMPLETED") {
    const recap = await loadRecap(roundRobinId);
    if (recap) {
      const champions = recap.champions.map((entry) => `${entry.name} (${entry.wins}-${entry.losses})`).join(", ");
      const body = `Champion${recap.champions.length > 1 ? "s" : ""}: ${champions}${recap.undefeated ? " -- undefeated" : ""}. ${recap.totals.games} games played. Open the round robin for the full recap.`;
      const players = await prisma.matchPlayer.findMany({ where: { match: { roundRobinId, deletedAt: null } }, select: { userId: true }, distinct: ["userId"] });
      await Promise.all(players.map((player) => notify(player.userId, "general", "ROUND_ROBIN_RECAP", `${roundRobin.name} recap`, body)));
    }
  }
  return NextResponse.json({ roundRobin: updated });
}
