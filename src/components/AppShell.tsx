"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Home, Search, Library, Sparkles } from "lucide-react";
import { useLibrary } from "@/store/library";
import { usePlayer } from "@/store/player";
import { Player } from "@/components/Player";
import { AudioEngine } from "@/components/AudioEngine";
import { FullscreenPlayer } from "@/components/FullscreenPlayer";
import { QueuePanel } from "@/components/QueuePanel";
import { PlaylistDialog } from "@/components/PlaylistDialog";
import { Sheets } from "@/components/Sheets";
import { PwaRuntime } from "@/components/PwaRuntime";
import { BottomNav } from "@/components/BottomNav";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Library", icon: Library },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bootstrap = useLibrary((s) => s.bootstrap);
  const toast = useLibrary((s) => s.toast);
  const hasTrack = usePlayer((s) => s.index >= 0);
  const openSheet = usePlayer((s) => s.openSheet);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const immersive = pathname === "/login" || pathname === "/signup" || pathname === "/recognize";
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-dvh bg-black text-white">
      {/* Desktop rail */}
      {!immersive && (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col items-center gap-2 border-r border-white/5 bg-black/80 py-5 backdrop-blur md:flex">
          <Link href="/" className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30">
            <Sparkles size={20} />
          </Link>
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex w-16 flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-semibold transition",
                isActive(n.href) ? "bg-white/10 text-white" : "text-muted hover:text-white",
              )}
            >
              <n.icon size={22} />
              {n.label}
            </Link>
          ))}
          <button
            onClick={() => openSheet("fab")}
            className="mt-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/40 transition hover:scale-105"
            aria-label="Quick actions"
          >
            <Sparkles size={22} />
          </button>
        </aside>
      )}

      {/* Content */}
      <main
        className={cn(
          "mx-auto min-h-dvh w-full max-w-5xl",
          !immersive && "md:pl-20",
          !immersive && (hasTrack ? "pb-44 md:pb-32" : "pb-28 md:pb-10"),
        )}
      >
        {children}
      </main>

      {/* Mini-player + Futuristic Animated Bottom Navigation Bar */}
      {!immersive && (
        <div className="fixed inset-x-0 bottom-0 z-40 md:left-20">
          <div className="mx-auto max-w-5xl">
            <Player />
            <BottomNav />
          </div>
        </div>
      )}

      <PwaRuntime />
      <AudioEngine />
      <FullscreenPlayer />
      <QueuePanel />
      <PlaylistDialog />
      <Sheets />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="pointer-events-none fixed bottom-40 left-1/2 z-[95] -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-xl md:bottom-28"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
