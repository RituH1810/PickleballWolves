import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { loadPlayerRecaps } from "@/lib/load-recap";
import { playerRecapHeadline } from "@/lib/round-robin-recap";
import { announceNewAchievements } from "@/lib/announce-achievements";
import { canRunRoundRobin } from "@/lib/round-robin-access";

export async function POST(_request: Request, context: { params: Promise<{ roundRobinId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to end this round robin." }, { status: 401 });
  const { roundRobinId } = await context.params;
  const roundRobin = await prisma.roundRobin.findUnique({ where: { id: roundRobinId } });
  if (!roundRobin) return NextResponse.json({ error: "Round robin not found." }, { status: 404 });
  if (!(await canRunRoundRobin(roundRobin, user.id))) return NextResponse.json({ error: "Only the organizer or a co-host can end this round robin." }, { status: 403 });
  const updated = await prisma.roundRobin.update({ where: { id: roundRobinId }, data: { status: "COMPLETED", completedAt: new Date() } });
  // Each player gets their own night in one line; the full recap is on the round robin page and
  // their personal recap card stays on the dashboard for a day.
  if (roundRobin.status !== "COMPLETED") {
    const recaps = await loadPlayerRecaps(roundRobinId);
    await Promise.all([...recaps].map(([userId, recap]) => notify(userId, "general", "ROUND_ROBIN_RECAP", `Your recap: ${roundRobin.name}`, `${playerRecapHeadline(recap)}. See the full breakdown on your dashboard.`)));
    // Ending it is what crowns the champion, so this is when round robin badges unlock.
    await announceNewAchievements([...recaps.keys()]);
  }
  return NextResponse.json({ roundRobin: updated });
}
