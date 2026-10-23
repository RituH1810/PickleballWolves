import { NextResponse } from "next/server";
import { sendOrganizerSummaries } from "@/lib/send-organizer-summaries";

// Monday morning, after Player of the Week: each group's organizers get last week's turnout summary.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await sendOrganizerSummaries());
}
