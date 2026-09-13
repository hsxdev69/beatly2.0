import type { MetadataRoute } from "next";

/**
 * PWA manifest — the web counterpart of an Android foreground service setup:
 * installable to the home screen, runs standalone, and (together with the
 * MediaSession API) keeps a media notification with ⏮ ▶️ ⏭ while the screen
 * is off.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Beatly",
    short_name: "Beatly",
    description: "Lightweight, private, ad-free music streaming with synced lyrics, offline cache and lock-screen controls.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    prefer_related_applications: false,
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["music", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
