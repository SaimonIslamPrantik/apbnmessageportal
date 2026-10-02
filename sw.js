// APBn Squad Message Portal - service worker (notifications)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Ready for Web Push (works even when the site is closed, once a push server is added)
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'APBn Squad', {
      body: data.body || 'New message received.',
      icon: 'group-logo.png',
      badge: 'group-logo.png',
      tag: 'apbn-chat-' + Date.now(),
      renotify: true,
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.postMessage({ type: 'notification-click' });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(self.registration.scope);
    })
  );
});
