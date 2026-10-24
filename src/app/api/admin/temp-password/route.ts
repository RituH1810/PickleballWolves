import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { EMAIL_PATTERN, generateTempPassword } from "@/lib/admin-access";
import { createAdminClient, findAuthUserByEmail } from "@/lib/supabase/admin";
import { getResend, REMINDER_FROM_EMAIL } from "@/lib/resend";
import { renderTempPasswordEmail } from "@/lib/temp-password-email";

/**
 * Admins only: give a player a temporary password -- for when emails (confirmation, reset) aren't
 * getting through. Confirms the email too, and creates the account if the sign-up never arrived.
 * The player must choose their own password at their next sign-in (must_change_password). It's
 * emailed to them through Resend (not Supabase's mail, which is what's usually failing); the admin
 * sees it only if that email couldn't be sent. Never stored; the action is in the audit log.
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
  let playerName = name;
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true, user_metadata: { ...existing.user_metadata, must_change_password: true } });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    userId = existing.id;
    playerName = (await prisma.user.findUnique({ where: { id: existing.id }, select: { name: true } }))?.name ?? (existing.user_metadata?.name as string | undefined) ?? "";
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: name || email.split("@")[0], must_change_password: true } });
    if (error || !data.user) return NextResponse.json({ error: error?.message ?? "Couldn't create the account." }, { status: 500 });
    userId = data.user.id;
  }

  // Email it to the player. If that fails, the admin gets the password to pass on themselves.
  let emailError: string | null = null;
  const resend = getResend();
  if (!resend) emailError = "Email isn't set up (RESEND_API_KEY).";
  else {
    const message = renderTempPasswordEmail({ name: playerName || email.split("@")[0], email, password, loginUrl: `${new URL(request.url).origin}/login` });
    const sent = await resend.emails.send({ from: REMINDER_FROM_EMAIL, to: email, subject: message.subject, html: message.html, text: message.text }).catch((error: Error) => ({ error }));
    if (sent.error) emailError = sent.error.message;
  }

  await prisma.auditLog.create({ data: { actorId: admin.id, entityType: "AuthUser", entityId: userId, action: existing ? "TEMP_PASSWORD_RESET" : "TEMP_PASSWORD_CREATE", afterData: { email, emailConfirmed: true, emailed: !emailError } } });
  return NextResponse.json({ email, created: !existing, wasConfirmed: Boolean(existing?.email_confirmed_at), emailed: !emailError, emailError, password: emailError ? password : null });
}
