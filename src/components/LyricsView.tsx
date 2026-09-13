"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Pause, Play, SkipBack, SkipForward, Languages, Check, Loader2 } from "lucide-react";
import { usePlayer } from "@/store/player";
import { fetchLyrics, translateLyrics, LYRICS_LANGUAGES, type Lyrics } from "@/lib/lyrics";
import { Artwork } from "@/components/Artwork";
import { cn } from "@/lib/utils";

export function LyricsView({ onBack }: { onBack: () => void }) {
  const track = usePlayer((s) => s.queue[s.index] ?? null);
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const { toggle, next, prev, requestSeek } = usePlayer();
  const [lyrics, setLyrics] = useState<Lyrics | null | undefined>(undefined);
  const [selectedLanguage, setSelectedLanguage] = useState("original");
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [translated, setTranslated] = useState<string[] | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch original lyrics per track; reset language on track change.
  useEffect(() => {
    if (!track) return;
    setLyrics(undefined);
    setSelectedLanguage("original");
    setTranslated(null);
    setTranslateError(false);
    let alive = true;
    fetchLyrics(track).then((l) => alive && setLyrics(l));
    return () => {
      alive = false;
    };
  }, [track]);

  // Close dropdown on outside click.
  useEffect(() => {
    if (!showLanguageDropdown) return;
    const onDown = (e: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowLanguageDropdown(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [showLanguageDropdown]);

  // Real-time translation: whenever the language or lyrics change, resolve
  // the translated line array. Timestamps are untouched so sync is preserved.
  useEffect(() => {
    setTranslated(null);
    setTranslateError(false);
    if (selectedLanguage === "original" || !lyrics) return;
    const sourceTexts = lyrics.synced
      ? lyrics.synced.map((l) => l.text)
      : (lyrics.plain ?? "").split("\n");
    if (!sourceTexts.length) return;
    let alive = true;
    setTranslating(true);
    // Reset scroll refs so the new lines can re-anchor.
    lineRefs.current = [];
    translateLyrics(sourceTexts, selectedLanguage)
      .then((lines) => {
        if (!alive) return;
        setTranslated(lines);
        setTranslating(false);
      })
      .catch(() => {
        if (!alive) return;
        setTranslating(false);
        setTranslateError(true);
      });
    return () => {
      alive = false;
    };
  }, [selectedLanguage, lyrics]);

  const active = useMemo(() => {
    const lines = lyrics?.synced;
    if (!lines?.length) return -1;
    let i = -1;
    for (let k = 0; k < lines.length; k++) if (lines[k].t <= currentTime + 0.25) i = k;
    return i;
  }, [lyrics, currentTime]);

  useEffect(() => {
    const el = lineRefs.current[active];
    const box = listRef.current;
    if (!el || !box) return;
    const top = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
    box.scrollTo({ top, behavior: "smooth" });
  }, [active, translated, selectedLanguage]);

  if (!track) return null;
  const dur = duration || track.duration || 0;
  const pct = dur ? (currentTime / dur) * 100 : 0;
  const isTranslated = selectedLanguage !== "original";
  const activeLang = LYRICS_LANGUAGES.find((l) => l.code === selectedLanguage);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pt-3">
        <button onClick={onBack} className="rounded-full p-2 hover:bg-white/10" aria-label="Back">
          <ChevronLeft size={26} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{track.title}</p>
          <p className="truncate text-xs text-white/60">{track.artist}</p>
        </div>

        {/* 1. Language selector icon + glassmorphic dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setShowLanguageDropdown((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition",
              isTranslated
                ? "bg-brand text-white shadow-lg shadow-brand/30"
                : "bg-white/10 text-white/80 hover:bg-white/15 hover:text-white",
            )}
            aria-label="Translate lyrics"
            aria-expanded={showLanguageDropdown}
          >
            {translating ? <Loader2 size={15} className="animate-spin" /> : <Languages size={15} />}
            {activeLang?.flag} {activeLang?.code === "original" ? "Lyrics" : activeLang?.label}
          </button>

          <AnimatePresence>
            {showLanguageDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="glass-strong absolute right-0 top-full z-50 mt-2 max-h-72 w-52 overflow-y-auto rounded-2xl p-1.5 shadow-2xl"
                role="menu"
              >
                <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50">
                  Translate to
                </p>
                {LYRICS_LANGUAGES.map((l) => {
                  const activeOpt = l.code === selectedLanguage;
                  return (
                    <button
                      key={l.code}
                      onClick={() => {
                        setSelectedLanguage(l.code);
                        setShowLanguageDropdown(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-semibold transition",
                        activeOpt ? "bg-brand/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
                      )}
                      role="menuitem"
                    >
                      <span className="text-base leading-none">{l.flag}</span>
                      <span className="flex-1">{l.label}</span>
                      {activeOpt && <Check size={15} className="text-brand" />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div ref={listRef} className="no-scrollbar relative mt-2 flex-1 overflow-y-auto px-6 py-[40vh]">
        {lyrics === undefined && (
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-6 w-2/3 animate-pulse rounded bg-white/10" style={{ width: `${45 + ((i * 17) % 40)}%` }} />
            ))}
          </div>
        )}
        {lyrics === null && (
          <div className="text-center">
            <p className="text-2xl font-bold">No lyrics found</p>
            <p className="mt-2 text-sm text-white/60">We couldn&apos;t find lyrics for this track yet.</p>
          </div>
        )}

        {/* 2. Real-time language switching: smooth crossfade to translated lines */}
        {lyrics?.synced && (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedLanguage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
            >
              {translating && (
                <div className="mb-4 flex items-center justify-center gap-2 text-sm text-white/60">
                  <Loader2 size={15} className="animate-spin" />
                  Translating to {activeLang?.label}…
                </div>
              )}
              {translateError && (
                <p className="mb-4 text-center text-sm text-red-300">
                  Translation unavailable — showing original lyrics.
                </p>
              )}
              {lyrics.synced.map((l, i) => {
                const text =
                  isTranslated && translated?.[i] !== undefined ? translated[i] : l.text;
                const showOriginal = isTranslated && !translating && translated?.[i] && translated[i].trim() !== l.text.trim();
                return (
                  <button
                    key={`${l.t}-${i}`}
                    ref={(el) => {
                      lineRefs.current[i] = el;
                    }}
                    onClick={() => requestSeek(l.t)}
                    className={cn(
                      "block w-full py-2 text-left transition-all duration-300 md:text-3xl",
                      i === active ? "scale-[1.02]" : "",
                    )}
                  >
                    <span
                      className={cn(
                        "block text-2xl font-bold leading-snug md:text-3xl",
                        i === active ? "text-white" : i < active ? "text-white/30" : "text-white/40",
                      )}
                    >
                      {text || "♪"}
                    </span>
                    {showOriginal && (
                      <span className="mt-0.5 block text-sm font-medium leading-snug text-white/35">
                        {l.text}
                      </span>
                    )}
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}

        {lyrics && !lyrics.synced && lyrics.plain && (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedLanguage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
            >
              {translating && (
                <div className="mb-4 flex items-center justify-center gap-2 text-sm text-white/60">
                  <Loader2 size={15} className="animate-spin" />
                  Translating to {activeLang?.label}…
                </div>
              )}
              <pre className="whitespace-pre-wrap font-sans text-xl font-semibold leading-relaxed text-white/80">
                {isTranslated && translated ? translated.join("\n") : lyrics.plain}
              </pre>
            </motion.div>
          </AnimatePresence>
        )}
        {lyrics && (
          <p className="mt-10 text-center text-xs text-white/40">
            Lyrics provided by {lyrics.source}
            {isTranslated && !translateError ? ` · Translated to ${activeLang?.label}` : ""}
          </p>
        )}
      </div>

      {/* Mini dock */}
      <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="glass relative overflow-hidden rounded-2xl">
          <div className="flex items-center gap-3 p-2 pr-3">
            <Artwork src={track.artwork} alt="" className="h-11 w-11 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{track.title}</p>
              <p className="truncate text-xs text-white/60">{track.artist}</p>
            </div>
            <button onClick={prev} className="p-2 text-white/80"><SkipBack size={20} fill="currentColor" /></button>
            <button onClick={toggle} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black">
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <button onClick={() => next()} className="p-2 text-white/80"><SkipForward size={20} fill="currentColor" /></button>
          </div>
          <div className="h-0.5 w-full bg-white/10">
            <div className="h-full bg-white" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
