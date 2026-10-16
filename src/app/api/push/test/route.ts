import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push";

// "Send a test" -- pushes a sample notification to the player's own devices.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await sendPush(user.id, { title: "PickleballWolves", body: "Phone notifications are on. You'll get game invites, reminders, and chat here.", url: "/notifications/settings", tag: "TEST" });
  return NextResponse.json({ ok: true });
}
