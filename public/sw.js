// PickleballWolves service worker: shows push notifications and opens the right page when one is
// tapped. It deliberately doesn't cache anything -- the app always loads fresh from the network.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let message = { title: "PickleballWolves", body: "", url: "/notifications" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    if (event.data) message.body = event.data.text();
  }
  event.waitUntil(self.registration.showNotification(message.title, {
    body: message.body,
    icon: "/api/pwa-icon/192",
    badge: "/api/pwa-icon/96",
    tag: message.tag,
    data: { url: message.url || "/notifications" },
  }));
});

// Focus an open PickleballWolves tab (navigating it) or open a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/notifications", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      return existing.navigate(url);
    }
    return self.clients.openWindow(url);
  })());
});
