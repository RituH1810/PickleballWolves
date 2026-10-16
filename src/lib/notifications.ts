import { prisma } from "@/lib/prisma";

export type NotificationCategory = "reminder" | "scoreDispute" | "challenge" | "achievement" | "general";

const PREFERENCE_FIELD: Partial<Record<NotificationCategory, "inAppReminders" | "scoreDisputeAlerts" | "challengeAlerts" | "achievementAlerts">> = {
  reminder: "inAppReminders",
  scoreDispute: "scoreDisputeAlerts",
  challenge: "challengeAlerts",
  achievement: "achievementAlerts",
};

/**
 * Writes a Notification row for the in-app notifications page/bell, respecting the matching
 * NotificationPreference flag for categories that have one. "general" notifications (e.g. "you
 * were added to this event by the organizer") have no dedicated opt-out in the schema yet, so
 * they're always sent.
 */
export async function notify(userId: string, category: NotificationCategory, type: string, title: string, body: string) {
  const field = PREFERENCE_FIELD[category];
  if (field) {
    const preference = await prisma.notificationPreference.findUnique({ where: { userId } });
    if (preference && preference[field] === false) return;
  }
  await prisma.notification.create({ data: { userId, type, title, body } });
}
