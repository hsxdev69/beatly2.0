"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Trash2, Loader2, Sparkles } from "lucide-react";
import { usePlayer } from "@/store/player";
import { Artwork } from "@/components/Artwork";
import { cn } from "@/lib/utils";

const ROW_H = 60; // px — keep in sync with the row layout
const OVERSCAN = 6;
const SCROLL_TOPUP_PX = 320; // request more radio when within N px of the bottom

export function QueuePanel() {
  const open = usePlayer((s) => s.queueOpen);
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const radioLoading = usePlayer((s) => s.radioLoading);
  const requestMoreRadio = usePlayer((s) => s.requestMoreRadio);
  const { setQueueOpen, jumpTo, removeFromQueue } = usePlayer();

  const current = queue[index];
  const upcoming = useMemo(() => queue.slice(index + 1), [queue, index]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [, forceRender] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(520);

  // Track viewport size so the window renders exactly enough rows to fill it.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight));
    ro.observe(el);
    setViewportH(el.clientHeight);
    return () => ro.disconnect();
  }, [open]);

  const totalH = upcoming.length * ROW_H;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(upcoming.length, Math.ceil((scrollTop + viewportH) / ROW_H) + OVERSCAN);
  const visible = upcoming.slice(start, end);
  const spacerTop = start * ROW_H;
  const spacerBottom = Math.max(0, totalH - end * ROW_H);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    // Force a render so the visible slice recomputes against the new scroll.
    forceRender((n) => n + 1);
    if (el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_TOPUP_PX) {
      requestMoreRadio();
    }
  }, [requestMoreRadio]);

  // Scroll the active row into view when the user jumps to a new track.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el || !current) return;
    el.scrollTop = 0;
    setScrollTop(0);
    forceRender((n) => n + 1);
  }, [current?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setQueueOpen(false)}
            className="fixed inset-0 z-[74] bg-black/50"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="glass-strong fixed bottom-0 right-0 top-0 z-[75] flex w-full max-w-sm flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Up Next</h3>
                {upcoming.length > 0 && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/70">
                    {upcoming.length}
                  </span>
                )}
                {radioLoading && <Loader2 size={14} className="animate-spin text-white/60" />}
              </div>
              <button onClick={() => setQueueOpen(false)} className="rounded-full p-1.5 hover:bg-white/10" aria-label="Close queue">
                <X size={20} />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3" onScroll={onScroll}>
              {current && (
                <>
                  <p className="px-2 pb-2 text-sm font-bold text-muted">Now playing</p>
                  <QueueRow track={current} active />
                </>
              )}
              <p className="flex items-center gap-2 px-2 pb-2 pt-5 text-sm font-bold text-muted">
                <Sparkles size={14} className="text-brand" />
                Next up {upcoming.length ? `· ${upcoming.length}` : ""}
              </p>

              {upcoming.length === 0 && !radioLoading && (
                <p className="px-2 text-sm text-muted">Nothing queued. Add songs to keep the music going.</p>
              )}

              {/* Virtualized upcoming list */}
              {upcoming.length > 0 && (
                <div style={{ height: totalH, position: "relative" }}>
                  <div style={{ position: "absolute", top: spacerTop, left: 0, right: 0 }}>
                    {visible.map((t, k) => (
                      <QueueRow
                        key={`${t.id}-${start + k}`}
                        track={t}
                        onPlay={() => jumpTo(index + 1 + start + k)}
                        onRemove={() => removeFromQueue(index + 1 + start + k)}
                      />
                    ))}
                  </div>
                  {spacerBottom > 0 && <div aria-hidden style={{ height: spacerBottom }} />}
                </div>
              )}

              {radioLoading && (
                <div className="mt-4 flex items-center justify-center gap-2 py-3 text-xs text-white/60">
                  <Loader2 size={14} className="animate-spin" /> Finding more for you…
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function QueueRow({
  track,
  active,
  onPlay,
  onRemove,
}: {
  track: { id: string; title: string; artist: string; artwork: string | null };
  active?: boolean;
  onPlay?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className={cn("group flex h-[60px] items-center gap-3 rounded-md p-2 hover:bg-white/5", active && "bg-white/5")}
      style={{ height: ROW_H }}
    >
      <button onClick={onPlay} className="flex min-w-0 flex-1 items-center gap-3 text-left" disabled={!onPlay}>
        <Artwork src={track.artwork} alt="" className="h-11 w-11 rounded-xl" />
        <div className="min-w-0">
          <p className={cn("truncate text-sm font-medium", active && "text-brand")}>{track.title}</p>
          <p className="truncate text-xs text-muted">{track.artist}</p>
        </div>
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-1.5 text-muted opacity-0 transition group-hover:opacity-100 hover:text-white"
          title="Remove"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
