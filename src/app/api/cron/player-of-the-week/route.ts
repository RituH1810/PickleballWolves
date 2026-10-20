import { NextResponse } from "next/server";
import { generatePlayerOfTheWeek } from "@/lib/generate-player-of-the-week";

// Runs Monday mornings (vercel.json) and picks each group's Player of the Week for last week.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await generatePlayerOfTheWeek());
}
