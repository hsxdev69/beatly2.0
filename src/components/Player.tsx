"use client";

import { Play, Pause, SkipBack, SkipForward, Heart, ListMusic, Volume2, VolumeX } from "lucide-react";
import { usePlayer } from "@/store/player";
import { useLibrary } from "@/store/library";
import { useLocal } from "@/store/local";
import { useArtworkColor, rgba, hexToRgb, luminance } from "@/lib/color";
import { cn } from "@/lib/utils";
import { Artwork } from "@/components/Artwork";

/** Floating "Liquid Glass" mini-player docked above the bottom navigation. */
export function Player() {
  const track = usePlayer((s) => s.queue[s.index] ?? null);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const muted = usePlayer((s) => s.muted);
  const volume = usePlayer((s) => s.volume);
  const { toggle, next, prev, setExpanded, setQueueOpen, toggleMute, setVolume } = usePlayer();
  const liked = useLibrary((s) => (track ? s.likedIds.has(track.id) : false));
  const toggleLike = useLibrary((s) => s.toggleLike);
  const dynamic = useLocal((s) => s.settings.dynamicTheme);
  const accentColor = useLocal((s) => s.settings.accentColor);
  const rgb = useArtworkColor(track?.artwork, dynamic);
  const accentRgb = hexToRgb(accentColor);
  const accentFg = luminance(accentRgb) > 0.35 ? "#000000" : "#ffffff";
  const accentShadow = `0 6px 24px -6px rgba(${accentRgb[0]},${accentRgb[1]},${accentRgb[2]},0.6), 0 0 12px rgba(${accentRgb[0]},${accentRgb[1]},${accentRgb[2]},0.4)`;
  if (!track) return null;

  const dur = duration || track.duration || 0;
  const pct = dur ? Math.min(100, (currentTime / dur) * 100) : 0;
  const accentGlowLine = `0 0 6px rgba(${accentRgb[0]},${accentRgb[1]},${accentRgb[2]},0.9)`;

  return (
    <div className="px-3 pb-2 md:px-6 md:pb-4">
      {/*
        1. THE LIQUID GLASS CONTAINER — maximum blur for milky-clear refraction,
        specular edge highlight, fully rounded pill.
        bg-white/20 dark:bg-black/30 backdrop-blur-3xl
        border-white/40 dark:border-white/20
        shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_10px_30px_rgba(0,0,0,0.3)]
      */}
      <div className="relative mx-auto max-w-3xl rounded-full border border-white/40 bg-white/20 backdrop-blur-3xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_10px_30px_rgba(0,0,0,0.3)] dark:border-white/20 dark:bg-black/30">
        {/* Decorative refraction layers (clipped to the pill) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
          {/* Glowing glass rim */}
          <span className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
          {/* Subtle album-art tint under the glass */}
          <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${rgba(rgb, 0.22)}, transparent 55%)` }} />
        </div>

        <div className="relative flex items-center gap-2 py-1.5 pl-1.5 pr-2.5">
          {/* Track info — high contrast text (text-white / text-white/70) */}
          <button onClick={() => setExpanded(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="shrink-0 rounded-full border border-white/40 bg-white/10 p-[3px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] dark:border-white/20">
              <Artwork src={track.artwork} alt={track.title} className="h-10 w-10 rounded-full md:h-11 md:w-11" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white drop-shadow-sm">{track.title}</span>
              <span className="block truncate text-xs text-white/70">{track.artist}</span>
            </span>
          </button>

          {/* Desktop extras (frosted glass controls) */}
          <div className="hidden items-center gap-1 md:flex">
            {!track.id.startsWith("local:") && (
              <button
                onClick={() => toggleLike(track)}
                className={cn(glassBtn, "h-9 w-9", liked ? "text-brand" : "text-white/70 hover:text-white")}
                aria-label="Like"
              >
                <Heart size={16} fill={liked ? "currentColor" : "none"} />
              </button>
            )}
            <button onClick={() => setQueueOpen(true)} className={cn(glassBtn, "h-9 w-9 text-white/70 hover:text-white")} aria-label="Queue">
              <ListMusic size={16} />
            </button>
            <button onClick={toggleMute} className={cn(glassBtn, "h-9 w-9 text-white/70 hover:text-white")} aria-label="Mute">
              {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-20"
              style={{ ["--pct" as string]: `${(muted ? 0 : volume) * 100}%`, ["--fill" as string]: "#ffffff" }}
              aria-label="Volume"
            />
          </div>

          {/* Transport — physical floating glass components */}
          <div className="flex items-center gap-1">
            <button onClick={prev} className={cn(glassBtn, "hidden h-9 w-9 sm:flex")} aria-label="Previous">
              <SkipBack size={16} fill="currentColor" />
            </button>
            <button
              onClick={toggle}
              className={cn(glassBtn, "h-11 w-11")}
              style={{ backgroundColor: accentColor, color: accentFg, boxShadow: accentShadow }}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <button onClick={() => next()} className={cn(glassBtn, "h-9 w-9")} aria-label="Next">
              <SkipForward size={16} fill="currentColor" />
            </button>
          </div>
        </div>

        {/* Progress hairline with soft accent glow */}
        <div className="pointer-events-none absolute inset-x-5 bottom-1 h-[3px] overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${pct}%`, backgroundColor: accentColor, color: '#fff', boxShadow: accentGlowLine }}
          />
        </div>
      </div>
    </div>
  );
}

/* Inner frosted pill used by transport / action icons:
   bg-white/30 dark:bg-white/10 + drop shadow = floating glass component. */
const glassBtn =
  "flex items-center justify-center rounded-full border border-white/40 bg-white/30 backdrop-blur-xl text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_2px_8px_rgba(0,0,0,0.35)] transition active:scale-95 dark:border-white/20 dark:bg-white/10";
