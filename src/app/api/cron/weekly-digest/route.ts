import { NextResponse } from "next/server";
import { sendWeeklyDigests } from "@/lib/send-weekly-digest";

// Runs Monday mornings (vercel.json): this week's games and last week's results, by email.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await sendWeeklyDigests(new URL(request.url).origin));
}
