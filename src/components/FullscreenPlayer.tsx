"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown, Cast, Download, Heart, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward,
  Captions, Timer, SlidersHorizontal, ListVideo, MoreHorizontal, CircleCheck,
} from "lucide-react";
import { usePlayer } from "@/store/player";
import { useLibrary } from "@/store/library";
import { useLocal } from "@/store/local";
import { formatDuration } from "@/lib/types";
import { useArtworkColor, rgba, shade, hexToRgb, luminance } from "@/lib/color";
import { cn } from "@/lib/utils";
import { Artwork } from "@/components/Artwork";
import { LyricsView } from "@/components/LyricsView";

export function FullscreenPlayer() {
  const expanded = usePlayer((s) => s.expanded);
  const lyricsOpen = usePlayer((s) => s.lyricsOpen);
  const track = usePlayer((s) => s.queue[s.index] ?? null);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const sleep = usePlayer((s) => s.sleep);
  const eq = usePlayer((s) => s.eq);
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const { toggle, next, prev, toggleShuffle, cycleRepeat, requestSeek, setExpanded, setLyricsOpen, openSheet } = usePlayer();
  const queueOpen = usePlayer((s) => s.queueOpen);
  const setQueueOpen = usePlayer((s) => s.setQueueOpen);
  const liked = useLibrary((s) => (track ? s.likedIds.has(track.id) : false));
  const toggleLike = useLibrary((s) => s.toggleLike);
  const notify = useLibrary((s) => s.notify);
  const dynamic = useLocal((s) => s.settings.dynamicTheme);
  const autoLyrics = useLocal((s) => s.settings.autoLyrics);
  const accentColor = useLocal((s) => s.settings.accentColor);
  const downloaded = useLocal((s) => (track ? !!s.downloads[track.id] : false));
  const progress = useLocal((s) => (track ? s.progress[track.id] : undefined));
  const { download, removeDownload } = useLocal();
  const rgb = useArtworkColor(track?.artwork, dynamic);

  // Keep the OS status bar in tune with the artwork while expanded.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute("content", expanded ? `rgb(${shade(rgb, 0.55).join(",")})` : "#000000");
  }, [rgb, expanded]);

  useEffect(() => {
    if (expanded && autoLyrics) setLyricsOpen(true);
  }, [expanded, autoLyrics, setLyricsOpen]);

  const accent = accentColor;
  const accentRgb = hexToRgb(accent);
  const accentFg = luminance(accentRgb) > 0.35 ? "#000000" : "#ffffff";
  const accentShadow = `0 12px 40px -8px rgba(${accentRgb[0]},${accentRgb[1]},${accentRgb[2]},0.55), 0 0 24px rgba(${accentRgb[0]},${accentRgb[1]},${accentRgb[2]},0.35)`;
  const accentGlow = `rgba(${accentRgb[0]},${accentRgb[1]},${accentRgb[2]},0.30)`;
  const accentViz = `rgba(${accentRgb[0]},${accentRgb[1]},${accentRgb[2]},0.95)`;

  const dur = duration || track?.duration || 0;
  const pct = dur ? Math.min(100, (currentTime / dur) * 100) : 0;
  const isLocal = track?.id.startsWith("local:") ?? false;

  return (
    <AnimatePresence>
      {expanded && track && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 280 }}
          className="fixed inset-0 z-50 overflow-hidden bg-black"
        >
          {/* Dynamic background */}
          <div
            className="absolute inset-0 transition-colors duration-700"
            style={{ background: `linear-gradient(180deg, ${rgba(shade(rgb, 0.85), 1)} 0%, ${rgba(shade(rgb, 0.45), 1)} 40%, #000 100%)` }}
          />
          {track.artwork && (
            <div className="pointer-events-none absolute inset-0 scale-125 bg-cover bg-center opacity-25 blur-3xl" style={{ backgroundImage: `url(${track.artwork})` }} />
          )}

          <div className="relative mx-auto flex h-full w-full max-w-md flex-col md:max-w-lg">
            <AnimatePresence mode="wait">
              {lyricsOpen ? (
                <motion.div key="lyrics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                  <LyricsView onBack={() => setLyricsOpen(false)} />
                </motion.div>
              ) : (
                <motion.div key="player" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full flex-col px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3">
                  {/* Top bar */}
                  <div className="flex items-center justify-between">
                    <button onClick={() => setExpanded(false)} className="rounded-full p-2 hover:bg-white/10" aria-label="Minimize">
                      <ChevronDown size={28} />
                    </button>
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Now Playing</p>
                      {track.album && <p className="max-w-[200px] truncate text-xs font-semibold text-white/80">{track.album}</p>}
                    </div>
                    <button onClick={() => openSheet("audio")} className="rounded-full p-2 hover:bg-white/10" aria-label="Audio output">
                      <Cast size={22} />
                    </button>
                  </div>

                  {/* Artwork */}
                  <div className="flex flex-1 items-center justify-center py-4">
                    <motion.div
                      key={track.id}
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: isPlaying ? 1 : 0.94 }}
                      transition={{ type: "spring", damping: 20, stiffness: 200 }}
                      className="w-full max-w-[min(78vw,360px)] md:max-w-[400px]"
                    >
                      <Artwork
                        src={track.artwork}
                        alt={track.title}
                        iconSize={80}
                        className="aspect-square w-full rounded-3xl shadow-2xl"
                        style={{ boxShadow: `0 30px 80px -20px ${rgba(rgb, 0.7)}` }}
                      />
                    </motion.div>
                  </div>

                  {/* Meta + actions */}
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-2xl font-extrabold leading-tight">{track.title}</h2>
                      <p className="truncate text-base text-white/70">{track.artist}</p>
                    </div>
                    {!isLocal && (
                      <button
                        onClick={() => (downloaded ? (removeDownload(track.id), notify("Download removed")) : download(track, notify))}
                        className={cn("relative rounded-full p-2", downloaded ? "text-brand" : "text-white/80 hover:text-white")}
                        aria-label="Download"
                      >
                        {progress !== undefined ? (
                          <svg width="26" height="26" viewBox="0 0 26 26" className="-rotate-90">
                            <circle cx="13" cy="13" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" fill="none" />
                            <circle cx="13" cy="13" r="10" stroke={accent} strokeWidth="2.5" fill="none" strokeDasharray={`${2 * Math.PI * 10}`} strokeDashoffset={`${2 * Math.PI * 10 * (1 - progress)}`} strokeLinecap="round" />
                          </svg>
                        ) : downloaded ? (
                          <CircleCheck size={26} />
                        ) : (
                          <Download size={26} />
                        )}
                      </button>
                    )}
                    {!isLocal && (
                      <button onClick={() => toggleLike(track)} className={cn("rounded-full p-2", liked ? "text-brand" : "text-white/80 hover:text-white")} aria-label="Like">
                        <Heart size={26} fill={liked ? "currentColor" : "none"} />
                      </button>
                    )}
                  </div>

                  {/* Timeline with visualizer */}
                  <div className="relative mt-5">
                    <svg className="pointer-events-none absolute inset-x-0 -top-3 h-8 w-full" viewBox="0 0 400 32" preserveAspectRatio="none">
                      <path
                        d="M0 16 C 20 4, 40 28, 60 16 S 100 4, 120 16 S 160 28, 180 16 S 220 4, 240 16 S 280 28, 300 16 S 340 4, 360 16 S 390 24, 400 16"
                        fill="none"
                        stroke={accentViz}
                        strokeWidth="1.5"
                        className={cn(isPlaying && "wave-line")}
                        style={{ opacity: isPlaying ? 0.7 : 0.2, clipPath: `inset(0 ${100 - pct}% 0 0)` }}
                      />
                    </svg>
                    <input
                      type="range"
                      min={0}
                      max={dur || 1}
                      step={0.1}
                      value={Math.min(currentTime, dur || 0)}
                      onChange={(e) => requestSeek(Number(e.target.value))}
                      className="relative w-full"
                      style={{
                        ["--pct" as string]: `${pct}%`,
                        ["--fill" as string]: accent,
                        ["--thumb" as string]: 1,
                        ["--thumb-color" as string]: accentFg === "#000000" ? "#000000" : "#ffffff",
                        ["--thumb-glow" as string]: accentGlow,
                      }}
                      aria-label="Seek"
                    />
                    <div className="mt-1 flex justify-between text-xs tabular-nums text-white/60">
                      <span>{formatDuration(currentTime)}</span>
                      <span>{formatDuration(dur)}</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="mt-3 flex items-center justify-between">
                    <button onClick={toggleShuffle} className={cn("p-2", shuffle ? "text-brand" : "text-white/70")} aria-label="Shuffle">
                      <Shuffle size={22} />
                    </button>
                    <button onClick={prev} className="p-2" aria-label="Previous">
                      <SkipBack size={34} fill="currentColor" />
                    </button>
                    <button
                      onClick={toggle}
                      className="flex h-[76px] w-[76px] items-center justify-center rounded-full transition active:scale-95"
                      style={{ backgroundColor: accent, color: accentFg, boxShadow: accentShadow }}
                      aria-label={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? <Pause size={34} fill="currentColor" /> : <Play size={34} fill="currentColor" className="ml-1" />}
                    </button>
                    <button onClick={() => next()} className="p-2" aria-label="Next">
                      <SkipForward size={34} fill="currentColor" />
                    </button>
                    <button onClick={cycleRepeat} className={cn("p-2", repeat !== "off" ? "text-brand" : "text-white/70")} aria-label="Repeat">
                      {repeat === "one" ? <Repeat1 size={22} /> : <Repeat size={22} />}
                    </button>
                  </div>

                  {/* Bottom toolbar */}
                  <div className="glass mt-5 flex items-center justify-around rounded-2xl px-2 py-1.5">
                    <Tool icon={Captions} label="Lyrics" onClick={() => setLyricsOpen(true)} />
                    <Tool icon={Timer} label="Sleep" active={!!sleep.endsAt || sleep.atTrackEnd} onClick={() => openSheet("sleep")} />
                    <Tool icon={SlidersHorizontal} label="EQ" active={eq.enabled} onClick={() => openSheet("eq")} />
                    <Tool icon={ListVideo} label="Up Next" active={queueOpen} onClick={() => setQueueOpen(true)} />
                    <Tool icon={MoreHorizontal} label="More" onClick={() => openSheet("more")} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Tool({ icon: Icon, label, onClick, active }: { icon: typeof Timer; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold transition hover:bg-white/10", active ? "text-brand" : "text-white/80")}>
      <Icon size={20} />
      {label}
    </button>
  );
}
