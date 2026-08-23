/*
 * Push service worker. This runs with the app closed — it is the only part of the front end that
 * does — so it deliberately depends on nothing: no framework, no bundle, no imports.
 */

self.addEventListener('push', (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return {};
    }
  })();

  // A push event must result in a visible notification. Browsers revoke the permission of sites
  // that receive pushes and show nothing, so there is always a fallback title.
  event.waitUntil(
    self.registration.showNotification(payload.title || 'London Borough Conquest', {
      body: payload.body || '',
      icon: '/assets/icon/icon-192.png',
      badge: '/assets/icon/icon-192.png',
      // A tag replaces an earlier notification with the same one rather than stacking: only one
      // borough is ever hot, so a previous "now hot" message is simply wrong.
      tag: payload.tag || undefined,
      data: { url: payload.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  // Prefer a window that is already open — opening a second copy of the game would be worse
  // than useless mid-match.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(target);
          }
          return client.focus();
        }
      }

      return self.clients.openWindow(target);
    }),
  );
});
