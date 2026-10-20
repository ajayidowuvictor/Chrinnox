// Chrinnox service worker: makes the app installable and shows a friendly page when offline.
// It never stores API responses or pages, so people always see fresh, private data.
const VERSION = "chrinnox-v2";
const SHELL = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
	event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener("fetch", (event) => {
	const req = event.request;
	if (req.method !== "GET") return;
	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return;
	if (url.pathname.startsWith("/api/")) return; // always live

	// opening a page: go to the network, fall back to the offline screen
	if (req.mode === "navigate") {
		event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
		return;
	}

	// built files have unique names, so they can be kept and reused
	if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
		event.respondWith(
			caches.match(req).then(
				(hit) =>
					hit ||
					fetch(req).then((res) => {
						if (res.ok) {
							const copy = res.clone();
							caches.open(VERSION).then((c) => c.put(req, copy));
						}
						return res;
					})
			)
		);
	}
});

// phone alerts
self.addEventListener("push", (event) => {
	let data = {};
	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = {};
	}
	event.waitUntil(
		self.registration.showNotification(data.title || "Chrinnox", {
			body: data.body || "You have a new notification",
			icon: "/icons/icon-192.png",
			badge: "/icons/icon-192.png",
			tag: data.tag,
			data: { url: data.url || "/" },
		})
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = (event.notification.data && event.notification.data.url) || "/";
	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
			for (const client of list) {
				if ("focus" in client) {
					client.navigate(url).catch(() => {});
					return client.focus();
				}
			}
			return self.clients.openWindow(url);
		})
	);
});
