import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { MONTHLY_MIN_MATCHES, recentMonths } from "@/lib/monthly-leaderboard";
import { loadMonthlyStandings } from "@/lib/load-monthly-leaderboard";

// The group's month-by-month leaderboard: this month (resets on the 1st) plus the two before it.
// Members only, like the rest of the group's results.
export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  if (membership?.status !== MembershipStatus.ACTIVE) return NextResponse.json({ error: "Join this group to see its leaderboard." }, { status: 403 });

  return NextResponse.json({ minMatches: MONTHLY_MIN_MATCHES, months: await loadMonthlyStandings(groupId, recentMonths()) });
}
