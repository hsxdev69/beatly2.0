"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Search, Library } from "lucide-react";
import { useLocal, DEFAULT_ACCENT } from "@/store/local";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Library", icon: Library },
] as const;

/**
 * Premium Futuristic Music-Player Bottom Navigation Bar
 *
 * Features:
 *  - Exactly 3 tabs: Home, Search, Library
 *  - Dark cinematic glassmorphism floating pill
 *  - Sliding active-tab morphing pill (layoutId spring animation)
 *  - Moving ambient colored light glow following the active tab
 *  - Bouncing active icon with spring rotation & glow pulse
 *  - Animated opacity & scale label transitions
 *  - Tactile press animation (whileTap scale & spring)
 *  - Full Android safe-area inset support (safe-b)
 */
export function BottomNav() {
  const pathname = usePathname();
  const accentColor = useLocal((s) => s.settings.accentColor) || DEFAULT_ACCENT;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="safe-b px-4 pb-2.5 pt-1 md:hidden">
      {/* Floating Glassmorphic Pill Dock */}
      <nav
        aria-label="Main Navigation"
        className="relative mx-auto flex h-[62px] max-w-[340px] items-center justify-around rounded-full border border-white/20 bg-black/60 p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_12px_36px_-6px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
      >
        {/* Specular Edge Top Highlight */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
          <span className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
        </div>

        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.icon;

          return (
            <motion.div
              key={tab.href}
              className="relative flex-1"
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 500, damping: 26 }}
            >
              {/* Moving Ambient Light/Glow following the active tab */}
              {active && (
                <motion.div
                  layoutId="bottomNavGlow"
                  className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-xl"
                  style={{
                    backgroundColor: accentColor,
                    opacity: 0.45,
                  }}
                  transition={{ type: "spring", stiffness: 360, damping: 30 }}
                />
              )}

              {/* Sliding & Morphing Active-Tab Frosted Pill */}
              {active && (
                <motion.div
                  layoutId="bottomNavActivePill"
                  className="absolute inset-0 rounded-full border border-white/30 bg-gradient-to-b from-white/25 to-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}

              {/* Tab Link */}
              <Link
                href={tab.href}
                className={cn(
                  "relative z-10 flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1 text-center transition-colors duration-200",
                  active ? "text-white" : "text-white/55 hover:text-white/80",
                )}
              >
                {/* Active Icon with Scale, Spring Bounce, and Subtle Rotation */}
                <motion.span
                  animate={
                    active
                      ? {
                          scale: [1, 1.24, 1.14],
                          rotate: [0, -5, 3, 0],
                          y: -1,
                        }
                      : {
                          scale: 1,
                          rotate: 0,
                          y: 0,
                        }
                  }
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 22,
                  }}
                  className="relative flex items-center justify-center"
                >
                  <Icon
                    size={20}
                    strokeWidth={active ? 2.5 : 2}
                    style={
                      active
                        ? {
                            color: accentColor,
                            filter: `drop-shadow(0 0 8px ${accentColor}90)`,
                          }
                        : undefined
                    }
                  />
                </motion.span>

                {/* Animated Label: Opacity + Width/Scale Transition */}
                <motion.span
                  animate={
                    active
                      ? { opacity: 1, scale: 1 }
                      : { opacity: 0.65, scale: 0.94 }
                  }
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className={cn(
                    "text-[10px] tracking-tight transition-all duration-200",
                    active ? "font-extrabold text-white" : "font-medium text-white/60",
                  )}
                  style={
                    active
                      ? {
                          textShadow: `0 0 10px ${accentColor}70`,
                        }
                      : undefined
                  }
                >
                  {tab.label}
                </motion.span>

                {/* Subtle Glowing Active Indicator Dot */}
                {active && (
                  <motion.span
                    layoutId="bottomNavIndicatorDot"
                    className="absolute bottom-1 h-0.5 w-3 rounded-full"
                    style={{
                      backgroundColor: accentColor,
                      boxShadow: `0 0 6px ${accentColor}, 0 0 1px ${accentColor}`,
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>
    </div>
  );
}
