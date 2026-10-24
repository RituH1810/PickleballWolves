import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { EMAIL_PATTERN, generateTempPassword } from "@/lib/admin-access";
import { createAdminClient, findAuthUserByEmail } from "@/lib/supabase/admin";

/**
 * Admins only: give a player a temporary password -- for when emails (confirmation, reset) aren't
 * getting through. Confirms the email too, and creates the account if the sign-up never arrived.
 * The player must choose their own password at their next sign-in (must_change_password). The
 * password is returned once and never stored; the action is recorded in the audit log.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY isn't set in Vercel yet." }, { status: 500 });

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Enter the player's email address." }, { status: 400 });

  const supabase = createAdminClient();
  const password = generateTempPassword();
  const existing = await findAuthUserByEmail(email);
  let userId: string;
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true, user_metadata: { ...existing.user_metadata, must_change_password: true } });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    userId = existing.id;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: name || email.split("@")[0], must_change_password: true } });
    if (error || !data.user) return NextResponse.json({ error: error?.message ?? "Couldn't create the account." }, { status: 500 });
    userId = data.user.id;
  }

  await prisma.auditLog.create({ data: { actorId: admin.id, entityType: "AuthUser", entityId: userId, action: existing ? "TEMP_PASSWORD_RESET" : "TEMP_PASSWORD_CREATE", afterData: { email, emailConfirmed: true } } });
  return NextResponse.json({ email, password, created: !existing, wasConfirmed: Boolean(existing?.email_confirmed_at) });
}
