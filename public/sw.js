/*
 * Beatly PWA service worker.
 *
 * This provides the installable/standalone Android app shell. Media playback
 * itself stays on the persistent HTMLMediaElement / YouTube player and is
 * intentionally NEVER cached or intercepted here: caching media streams can
 * break Range requests, seeking, and MediaSession background playback.
 */
const VERSION = "echo-shell-v3";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  // Never intercept non-HTTP requests (blob:/data: media for offline files).
  if (!/^https?:$/.test(new URL(request.url).protocol)) return;
  const url = new URL(request.url);

  // Never intercept stream/API requests. Range media must reach the resolver.
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/__media/") ||
    request.destination === "audio" ||
    request.headers.has("range")
  ) {
    return;
  }

  // Static chunks/images: cache-first. Pages: network-first with shell fallback.
  if (url.pathname.startsWith("/_next/static/") || request.destination === "image") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      }),
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
  );
});
