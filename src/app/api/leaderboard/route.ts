import { NextResponse } from "next/server";
import { buildLeaderboard } from "@/lib/leaderboard";

export async function GET() {
  return NextResponse.json({ leaderboard: await buildLeaderboard() });
}
