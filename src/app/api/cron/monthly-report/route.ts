import { NextResponse } from "next/server";
import { sendMonthlyReports } from "@/lib/send-monthly-reports";

// Runs on the 1st of each month (vercel.json) and sends everyone who played their report card for the month that just ended.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await sendMonthlyReports());
}
