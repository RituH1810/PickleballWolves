import { createClient, type User } from "@supabase/supabase-js";

/**
 * Supabase with the service-role key: can manage any account (set passwords, confirm emails). Server
 * only -- never import this into a client component, and only call it after requireAdmin().
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const PAGE_SIZE = 1000;

/** The auth account with this email (case-insensitive), including unconfirmed sign-ups, or null. */
export async function findAuthUserByEmail(email: string): Promise<User | null> {
  const admin = createAdminClient();
  const wanted = email.trim().toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === wanted);
    if (match) return match;
    if (data.users.length < PAGE_SIZE) return null;
  }
}
