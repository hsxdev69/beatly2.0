import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ThemeAccent } from "@/components/ThemeAccent";

export const metadata: Metadata = {
  title: "Beatly",
  description:
    "Beatly — lightweight, private, ad-free music streaming with synced lyrics, offline cache and background playback.",
  applicationName: "Beatly",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Beatly",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white antialiased">
        <ThemeAccent />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
