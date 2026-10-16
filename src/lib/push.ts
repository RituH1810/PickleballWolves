import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured: boolean | null = null;

/** Push needs a VAPID key pair (see .env.example). Without it, notifications stay in-app only. */
function ensureConfigured() {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  configured = Boolean(publicKey && privateKey);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@pickleballwolves.com", publicKey!, privateKey!);
  return configured;
}

export type PushMessage = { title: string; body: string; url: string; tag?: string };

/**
 * Sends a push to every phone/browser the player turned notifications on for. Subscriptions the
 * push service says are gone (uninstalled app, revoked permission) are cleaned up. Never throws:
 * a failed push must not break the in-app notification it accompanies.
 */
export async function sendPush(userId: string, message: PushMessage) {
  if (!ensureConfigured()) return;
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(message), { TTL: 60 * 60 * 12 });
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
    }
  }));
}
