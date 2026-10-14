import { NextResponse } from "next/server";
import { generateRecurringGames } from "@/lib/generate-recurring";

// Runs hourly (vercel.json). Each run tops every schedule up to a week ahead; most runs create nothing.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const created = await generateRecurringGames();
  return NextResponse.json({ created });
}
