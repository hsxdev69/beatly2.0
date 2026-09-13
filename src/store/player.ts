"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Track } from "@/lib/types";

export type RepeatMode = "off" | "all" | "one";
export type SheetKind = "fab" | "sleep" | "eq" | "audio" | "more" | "group" | "region" | null;
export type EqState = { enabled: boolean; preset: string; gains: number[] };

export const EQ_BANDS = [60, 230, 910, 3600, 14000];
export const EQ_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0],
  Bass: [6, 4, 0, -1, -1],
  Treble: [-2, -1, 0, 3, 5],
  Vocal: [-2, 1, 4, 3, 0],
  Rock: [4, 2, -1, 2, 4],
  Pop: [-1, 2, 4, 2, -1],
  Electronic: [5, 2, 0, 2, 4],
  Acoustic: [3, 1, 1, 2, 2],
  Loudness: [5, 0, -1, 0, 5],
};

type PlayerState = {
  queue: Track[];
  index: number;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  muted: boolean;
  expanded: boolean;
  queueOpen: boolean;
  lyricsOpen: boolean;
  sheet: SheetKind;
  sleep: { endsAt: number | null; atTrackEnd: boolean };
  eq: EqState;
  currentTime: number;
  duration: number;
  seekTo: number | null;
  /** Video id of the track that seeded the current infinite-radio queue. */
  radioSeedId: string | null;
  radioLoading: boolean;
  radioLastFetchedAt: number | null;

  current: () => Track | null;
  playTrack: (track: Track, context?: Track[]) => void;
  playQueue: (tracks: Track[], startIndex?: number) => void;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (i: number) => void;
  jumpTo: (i: number) => void;
  toggle: () => void;
  setPlaying: (v: boolean) => void;
  next: (auto?: boolean) => void;
  prev: () => void;
  /** Top up the queue with more radio tracks when we're near the end. */
  requestMoreRadio: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setExpanded: (v: boolean) => void;
  setQueueOpen: (v: boolean) => void;
  setLyricsOpen: (v: boolean) => void;
  openSheet: (s: SheetKind) => void;
  setSleep: (minutes: number | null, atTrackEnd?: boolean) => void;
  setEq: (patch: Partial<EqState>) => void;
  setProgress: (t: number, d: number) => void;
  requestSeek: (t: number) => void;
  clearSeek: () => void;
};

function shuffled<T>(arr: T[], keepFirst: T): T[] {
  const rest = arr.filter((x) => x !== keepFirst);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [keepFirst, ...rest];
}

/**
 * Dynamic "Up Next" queue sync (API radio).
 *
 * After the user plays a track, ask the backend for the catalog provider's "Up Next"
 * recommendations and swap the entire queue for [current, ...related], so the
 * Up-Next drawer always shows radio picks matching the playing song.
 */
/** True when the track has an offline copy (downloaded) or is a device-local file. */
function isOfflineTrack(id: string): boolean {
  if (id.startsWith("local:")) return true;
  try {
    // Lazy read of the persisted local store (avoids a circular import).
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("echo-local-v1") : null;
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: { downloads?: Record<string, unknown> } };
    return !!parsed.state?.downloads?.[id];
  } catch {
    return false;
  }
}

const RADIO_LIMIT = 120;
const RADIO_MORE_LIMIT = 80;
const RADIO_TOPUP_THRESHOLD = 10; // request more when within N of the end
const RADIO_TOPUP_COOLDOWN_MS = 15_000;

/**
 * Fetch 100+ related tracks from /api/related (radio backend), dedupe against
 * the current queue, and append after the current index. Skipped entirely for
 * offline/local contexts or when offline.
 */
async function fetchAndAppendRadio(seedId: string, limit: number, isTopUp = false): Promise<void> {
  const s = usePlayer.getState();
  if (s.radioLoading) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if (!seedId || seedId.startsWith("local:")) return;

  usePlayer.setState({ radioLoading: true, radioSeedId: seedId });
  try {
    const res = await fetch(`/api/related?videoId=${encodeURIComponent(seedId)}&limit=${limit}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return;
    const json = (await res.json()) as { tracks?: Track[] };
    const fresh = json.tracks ?? [];
    if (!fresh.length) return;

    const state = usePlayer.getState();
    // For initial syncRadioQueue, the seed must still be playing; for top-up
    // we just keep filling the queue regardless of current position.
    if (!isTopUp && state.queue[state.index]?.id !== seedId) return;
    const existingIds = new Set(state.queue.map((t) => t.id));
    const additions = fresh.filter((t) => !existingIds.has(t.id));
    if (!additions.length) return;

    const queue = [...state.queue];
    // Splice new tracks after the current index, preserving what's already
    // queued ahead of us (manual "Play next" / "Add to queue" wins over radio).
    queue.splice(state.index + 1, 0, ...additions);
    usePlayer.setState({ queue });
  } catch {
    /* best-effort */
  } finally {
    usePlayer.setState({ radioLoading: false, radioLastFetchedAt: Date.now() });
  }
}

async function syncRadioQueue(track: Track, context?: Track[]) {
  if (track.id.startsWith("local:")) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if (context?.some((t) => t.id.startsWith("local:"))) return;
  if (context && context.length > 1 && context.every((t) => isOfflineTrack(t.id))) return;
  await fetchAndAppendRadio(track.videoId || track.id, RADIO_LIMIT);
}

async function topUpRadioQueue(): Promise<void> {
  const { queue, index, radioSeedId, radioLoading, radioLastFetchedAt } = usePlayer.getState();
  if (radioLoading) return;
  if (radioLastFetchedAt && Date.now() - radioLastFetchedAt < RADIO_TOPUP_COOLDOWN_MS) return;
  const remaining = queue.length - 1 - index;
  if (remaining > RADIO_TOPUP_THRESHOLD) return;
  if (!radioSeedId) return;
  await fetchAndAppendRadio(radioSeedId, RADIO_MORE_LIMIT, true);
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      index: -1,
      isPlaying: false,
      shuffle: false,
      repeat: "off",
      volume: 0.9,
      muted: false,
      expanded: false,
      queueOpen: false,
      lyricsOpen: false,
      sheet: null,
      sleep: { endsAt: null, atTrackEnd: false },
      eq: { enabled: false, preset: "Flat", gains: [0, 0, 0, 0, 0] },
      currentTime: 0,
      duration: 0,
      seekTo: null,
      radioSeedId: null,
      radioLoading: false,
      radioLastFetchedAt: null,

      current: () => get().queue[get().index] ?? null,
      playTrack: (track, context) => {
        const ctx = context && context.length ? context : [track];
        const list = get().shuffle ? shuffled(ctx, track) : ctx;
        const idx = Math.max(0, list.findIndex((t) => t.id === track.id));
        // Fresh seed — any previous radio tracks belong to the old song.
        set({
          queue: list,
          index: idx,
          isPlaying: true,
          currentTime: 0,
          radioSeedId: track.videoId || track.id,
          radioLoading: false,
          radioLastFetchedAt: null,
        });
        // Dynamic "Up Next" sync: populate the queue with 100+ radio picks
        // for the song that just started (skipped for offline contexts).
        syncRadioQueue(track, ctx);
      },
      playQueue: (tracks, startIndex = 0) => {
        if (!tracks.length) return;
        const start = tracks[startIndex] ?? tracks[0];
        const list = get().shuffle ? shuffled(tracks, start) : tracks;
        set({ queue: list, index: list.indexOf(start), isPlaying: true, currentTime: 0 });
      },
      addToQueue: (track) => {
        const { queue, index } = get();
        if (index < 0) return set({ queue: [track], index: 0, isPlaying: true });
        set({ queue: [...queue, track] });
      },
      playNext: (track) => {
        const { queue, index } = get();
        if (index < 0) return set({ queue: [track], index: 0, isPlaying: true });
        const q = [...queue];
        q.splice(index + 1, 0, track);
        set({ queue: q });
      },
      removeFromQueue: (i) => {
        const { queue, index } = get();
        if (i === index) return;
        set({ queue: queue.filter((_, k) => k !== i), index: i < index ? index - 1 : index });
      },
      jumpTo: (i) => set({ index: i, isPlaying: true, currentTime: 0 }),
      toggle: () => set((s) => ({ isPlaying: s.index >= 0 ? !s.isPlaying : false })),
      setPlaying: (v) => set({ isPlaying: v }),
      next: (auto = false) => {
        const { queue, index, repeat, sleep } = get();
        if (!queue.length) return;
        if (auto && sleep.atTrackEnd) return set({ isPlaying: false, sleep: { endsAt: null, atTrackEnd: false }, seekTo: 0 });
        if (auto && repeat === "one") return set({ seekTo: 0, isPlaying: true });
        if (index + 1 < queue.length) {
          set({ index: index + 1, isPlaying: true, currentTime: 0 });
          // Auto-top-up the radio when approaching the end of the queue.
          if (queue.length - (index + 1) - 1 <= RADIO_TOPUP_THRESHOLD) topUpRadioQueue();
          return;
        }
        if (repeat === "all") return set({ index: 0, isPlaying: true, currentTime: 0 });
        set({ isPlaying: false, seekTo: 0 });
      },
      prev: () => {
        const { index, currentTime } = get();
        if (currentTime > 3 || index <= 0) return set({ seekTo: 0 });
        set({ index: index - 1, isPlaying: true, currentTime: 0 });
      },
      toggleShuffle: () => {
        const { shuffle, queue, index } = get();
        const cur = queue[index];
        if (!shuffle && cur) return set({ shuffle: true, queue: shuffled(queue, cur), index: 0 });
        set({ shuffle: !shuffle });
      },
      cycleRepeat: () => set((s) => ({ repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off" })),
      setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)), muted: false }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      setExpanded: (v) => set({ expanded: v, lyricsOpen: v ? get().lyricsOpen : false }),
      setQueueOpen: (v) => set({ queueOpen: v }),
      setLyricsOpen: (v) => set({ lyricsOpen: v }),
      openSheet: (s) => set({ sheet: s }),
      setSleep: (minutes, atTrackEnd = false) =>
        set({ sleep: { endsAt: minutes ? Date.now() + minutes * 60_000 : null, atTrackEnd } }),
      setEq: (patch) => set((s) => ({ eq: { ...s.eq, ...patch } })),
      setProgress: (t, d) => set({ currentTime: t, duration: d }),
      requestSeek: (t) => set({ seekTo: t, currentTime: t }),
      clearSeek: () => set({ seekTo: null }),
      requestMoreRadio: () => topUpRadioQueue(),
    }),
    {
      name: "echo-player-v1",
      partialize: (s) => ({
        queue: s.queue,
        index: s.index,
        shuffle: s.shuffle,
        repeat: s.repeat,
        volume: s.volume,
        muted: s.muted,
        eq: s.eq,
      }),
      // Self-heal persisted state: drop corrupt/legacy queue entries and clamp
      // the index so a poisoned snapshot can never brick playback on reload.
      onRehydrateStorage: () => (persisted, error) => {
        if (error || !persisted) return;
        try {
          const raw = persisted as unknown as {
            queue?: unknown;
            index?: unknown;
            volume?: unknown;
            eq?: unknown;
          };
          const queue = (Array.isArray(raw.queue) ? raw.queue : []).filter(
            (t): t is Track =>
              !!t &&
              typeof (t as Track).id === "string" &&
              (t as Track).id.length > 0 &&
              typeof (t as Track).videoId === "string" &&
              (t as Track).videoId.length > 0,
          );
          const index =
            queue.length === 0
              ? -1
              : Math.min(Math.max(0, Number(raw.index) || 0), queue.length - 1);
          const patch: Partial<PlayerState> = { queue, index };
          const vol = Number(raw.volume);
          if (!Number.isFinite(vol)) patch.volume = 0.9;
          const eq = raw.eq as EqState | undefined;
          if (!eq || !Array.isArray(eq.gains) || eq.gains.length !== 5) {
            patch.eq = { enabled: false, preset: "Flat", gains: [0, 0, 0, 0, 0] };
          }
          usePlayer.setState(patch as Partial<PlayerState>);
        } catch {
          /* keep defaults */
        }
      },
    },
  ),
);
