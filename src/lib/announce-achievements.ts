import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { loadAchievements } from "@/lib/load-achievements";

/**
 * Records every badge these players have now earned, returning the ones that are new. Recording
 * is what makes "Achievement unlocked!" fire exactly once per badge: a badge already on file (or
 * one recorded by a concurrent save) is skipped.
 */
export async function recordUnlockedAchievements(userId: string) {
  const unlocked = (await loadAchievements(userId)).filter((achievement) => achievement.unlocked);
  const known = new Set((await prisma.achievementUnlock.findMany({ where: { userId }, select: { achievementId: true } })).map((row) => row.achievementId));
  const fresh = [];
  for (const achievement of unlocked.filter((entry) => !known.has(entry.id))) {
    try {
      await prisma.achievementUnlock.create({ data: { userId, achievementId: achievement.id, unlockedAt: achievement.unlockedAt ?? new Date() } });
      fresh.push(achievement);
    } catch (error) {
      // Another request recorded it first -- it's theirs to announce.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }
  return fresh;
}

/** Call after a score is saved: tells each player about any badge that score just earned them. */
export async function announceNewAchievements(userIds: string[]) {
  await Promise.all([...new Set(userIds)].map(async (userId) => {
    const fresh = await recordUnlockedAchievements(userId);
    await Promise.all(fresh.map((achievement) => notify(userId, "achievement", "ACHIEVEMENT_UNLOCKED", `Achievement unlocked: ${achievement.name}`, `${achievement.description} It's on your profile now.`)));
  }));
}
