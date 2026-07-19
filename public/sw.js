// Push notification service worker for The Hotel Hub.
// Tiny: push + notificationclick only. No app-shell caching.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { title: "The Hotel Hub", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "The Hotel Hub";
  const options = {
    body: data.body || " ",
    icon: "/favicon-192.png",
    badge: "/favicon-192.png",
    tag: data.tag || undefined,
    renotify: !!data.tag,
    requireInteraction: false,
    silent: false,
    vibrate: [120, 60, 120],
    data: { url: data.url || "/app" },
  };
  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      // Fall back to a minimal notification if the browser rejected the options
      // (e.g. bad icon path on some Android builds).
      return self.registration.showNotification(title, {
        body: data.body || " ",
        data: { url: data.url || "/app" },
      }).catch(() => {
        console.error("[sw] showNotification failed", err);
      });
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        try {
          const u = new URL(client.url);
          if (u.origin === self.location.origin) {
            await client.focus();
            try { await client.navigate(targetUrl); } catch (_e) {}
            return;
          }
        } catch (_e) {}
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
