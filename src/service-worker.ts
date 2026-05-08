import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: any;

self.skipWaiting();

precacheAndRoute(self.__WB_MANIFEST);

// Set up App Shell / Navigation Fallback
// This allows the app to work offline for all navigation requests (SPA)
try {
  const handler = createHandlerBoundToURL('/index.html');
  const navigationRoute = new NavigationRoute(handler, {
    denylist: [
      new RegExp('/__/'), // Exclude Firebase reserved URLs
    ],
  });
  registerRoute(navigationRoute);
} catch (e) {
  console.log("Could not set up navigation fallback", e);
}

self.addEventListener("push", (event: any) => {
  const data = event.data ? event.data.json() : { title: "Nova Notificação", body: "Você recebeu uma mensagem." };

  const options = {
    body: data.body,
    icon: "/logo192.png",
    badge: "/logo192.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/"
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", (event: any) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(event.notification.data.url)
  );
});
