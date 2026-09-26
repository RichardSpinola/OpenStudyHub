self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const url = typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/today";
  event.waitUntil(self.registration.showNotification("OpenStudyHub", {
    body: "Você tem uma nova notificação.",
    icon: "/brand/notification-icon.png",
    data: { url },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/today", self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const visible = clients.find((client) => client.url.startsWith(self.location.origin));
    if (visible) { await visible.focus(); await visible.navigate(url.href); }
    else await self.clients.openWindow(url.href);
  }));
});
