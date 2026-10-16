import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const FIELDS = ["emailReminders", "inAppReminders", "challengeAlerts", "scoreDisputeAlerts", "weeklyDigest", "achievementAlerts"] as const;
type Preferences = Record<(typeof FIELDS)[number], boolean>;

// Matches the schema defaults: a player with no row yet gets everything.
const DEFAULTS: Preferences = { emailReminders: true, inAppReminders: true, challengeAlerts: true, scoreDisputeAlerts: true, weeklyDigest: true, achievementAlerts: true };

function pick(row: Preferences): Preferences {
  return Object.fromEntries(FIELDS.map((field) => [field, row[field]])) as Preferences;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const preference = await prisma.notificationPreference.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ preferences: preference ? pick(preference) : DEFAULTS });
}

// Partial update: only the boolean fields present in the body change.
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const changes: Partial<Preferences> = {};
  for (const field of FIELDS) if (typeof body?.[field] === "boolean") changes[field] = body[field];
  if (!Object.keys(changes).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const preference = await prisma.notificationPreference.upsert({ where: { userId: user.id }, update: changes, create: { userId: user.id, ...DEFAULTS, ...changes } });
  return NextResponse.json({ preferences: pick(preference) });
}
