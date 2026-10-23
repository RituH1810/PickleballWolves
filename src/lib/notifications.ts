import { prisma } from "@/lib/prisma";
import { sendPush } from "@/lib/push";

export type NotificationCategory = "reminder" | "scoreDispute" | "challenge" | "achievement" | "gameChat" | "digest" | "general";

const PREFERENCE_FIELD: Partial<Record<NotificationCategory, "inAppReminders" | "scoreDisputeAlerts" | "challengeAlerts" | "achievementAlerts" | "gameChatAlerts" | "weeklyDigest">> = {
  reminder: "inAppReminders",
  scoreDispute: "scoreDisputeAlerts",
  challenge: "challengeAlerts",
  achievement: "achievementAlerts",
  gameChat: "gameChatAlerts",
  // Weekly summaries (the organizer summary) follow the same switch as the weekly digest email.
  digest: "weeklyDigest",
};

/**
 * Writes a Notification row for the in-app notifications page/bell, respecting the matching
 * NotificationPreference flag for categories that have one, and pushes it to any phones the player
 * turned notifications on for. "general" notifications (e.g. "you were added to this event by the
 * organizer") have no dedicated opt-out, so they're always sent. `url` is where tapping the phone
 * notification opens.
 */
export async function notify(userId: string, category: NotificationCategory, type: string, title: string, body: string, url = "/notifications") {
  // Guest players (added by name, no login) can't read notifications.
  const recipient = await prisma.user.findUnique({ where: { id: userId }, select: { isGuest: true } });
  if (!recipient || recipient.isGuest) return;
  const field = PREFERENCE_FIELD[category];
  if (field) {
    const preference = await prisma.notificationPreference.findUnique({ where: { userId } });
    if (preference && preference[field] === false) return;
  }
  await prisma.notification.create({ data: { userId, type, title, body } });
  await sendPush(userId, { title, body, url, tag: type });
}
