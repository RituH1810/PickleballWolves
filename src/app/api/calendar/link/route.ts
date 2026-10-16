import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { calendarTokenFor, feedUrls, newCalendarToken } from "@/lib/calendar-feed";

async function signedInUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// The signed-in player's subscription links (creating their private token on first use).
export async function GET(request: Request) {
  const userId = await signedInUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(feedUrls(new URL(request.url).origin, await calendarTokenFor(userId)));
}

// Reset: issues a new token, so any previously shared link stops working.
export async function POST(request: Request) {
  const userId = await signedInUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = newCalendarToken();
  await prisma.user.update({ where: { id: userId }, data: { calendarToken: token } });
  return NextResponse.json(feedUrls(new URL(request.url).origin, token));
}
