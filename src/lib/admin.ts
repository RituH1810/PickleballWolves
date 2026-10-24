import { UserRole } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";
import { isAdminEmail, parseAdminEmails } from "@/lib/admin-access";

/**
 * The signed-in admin, or null. Admins are users with the ADMIN role, or whose email is listed in
 * the ADMIN_EMAILS environment variable (so the club account is an admin from its first sign-in).
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // Make sure they have a profile: admin actions are recorded against it in the audit log.
  const profile = await ensureProfile(user);
  const isAdmin = profile.role === UserRole.ADMIN || isAdminEmail(user.email, parseAdminEmails(process.env.ADMIN_EMAILS));
  return isAdmin ? { id: profile.id, email: user.email ?? null } : null;
}
