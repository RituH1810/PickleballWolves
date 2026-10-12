import { prisma } from "@/lib/prisma";
import type { User } from "@supabase/supabase-js";

export async function ensureProfile(user: User) {
  return prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email ?? undefined },
    create: { id: user.id, email: user.email ?? `${user.id}@placeholder.local`, name: user.user_metadata.name ?? user.email?.split("@")[0] ?? "Player", skillRating: 2.0 },
  });
}
