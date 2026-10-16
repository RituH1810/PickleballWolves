import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

async function signedInUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Saves this phone/browser's push subscription for the signed-in player. A device that was
// subscribed under another account moves to this one.
export async function POST(request: Request) {
  const userId = await signedInUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || typeof p256dh !== "string" || typeof auth !== "string") return NextResponse.json({ error: "That isn't a valid push subscription." }, { status: 400 });
  await prisma.pushSubscription.upsert({ where: { endpoint }, update: { userId, p256dh, auth }, create: { userId, endpoint, p256dh, auth } });
  return NextResponse.json({ ok: true });
}

// Turns push off for this device.
export async function DELETE(request: Request) {
  const userId = await signedInUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.endpoint === "string") await prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId } });
  return NextResponse.json({ ok: true });
}
