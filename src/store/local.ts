"use client";
/**
 * Device-local state (no backend): listening history & play counts (My top 50),
 * offline downloads, imported local files, recent searches, recognition history
 * and app settings. Media bytes live in the Cache API (src/lib/blobs.ts).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TrackSnapshot } from "@/db/schema";
import { streamPath, toSnapshot, type Track } from "@/lib/types";
import { deleteBlob, hasBlob, putBlob } from "@/lib/blobs";

export type HistoryEntry = { track: TrackSnapshot; at: number };
export type CountEntry = { track: TrackSnapshot; n: number; last: number };
export type DownloadEntry = { track: TrackSnapshot; size: number; at: number };
export type LocalEntry = { track: TrackSnapshot; size: number; at: number; name: string };
export type Recognition = { at: number; ok: boolean; title?: string; artist?: string; album?: string };

/** Matches a preset from ACCENT_PRESETS or a custom `#rrggbb` hex string. */
export type AccentColor = string;
export type Settings = {
  fade: number;
  dynamicTheme: boolean;
  autoLyrics: boolean;
  dataSaver: boolean;
  accentColor: AccentColor;
};

/** Predefined accent themes offered in Settings → Appearance. */
export const ACCENT_PRESETS: Array<{ key: string; label: string; color: string }> = [
  { key: "crimson", label: "Crimson", color: "#e61745" },
  { key: "emerald", label: "Emerald", color: "#10b981" },
  { key: "neon-blue", label: "Neon Blue", color: "#2aa6ff" },
  { key: "amber", label: "Amber", color: "#f59e0b" },
  { key: "violet", label: "Violet", color: "#8b5cf6" },
  { key: "pink", label: "Pink", color: "#ff4f8b" },
  { key: "rose", label: "Rose", color: "#f43f5e" },
  { key: "cyan", label: "Cyan", color: "#06b6d4" },
  { key: "lime", label: "Lime", color: "#84cc16" },
];

export const DEFAULT_ACCENT = "#ff4f8b";

type LocalState = {
  history: HistoryEntry[];
  counts: Record<string, CountEntry>;
  downloads: Record<string, DownloadEntry>;
  progress: Record<string, number>;
  local: Record<string, LocalEntry>;
  recentSearches: string[];
  recognitions: Recognition[];
  settings: Settings;

  recordPlay: (track: Track) => void;
  clearHistory: () => void;
  download: (track: Track, notify?: (m: string) => void) => Promise<void>;
  removeDownload: (id: string) => Promise<void>;
  importLocal: (files: FileList | File[], notify?: (m: string) => void) => Promise<void>;
  removeLocal: (id: string) => Promise<void>;
  addSearch: (q: string) => void;
  addRecognition: (r: Recognition) => void;
  setSettings: (p: Partial<Settings>) => void;
  topTracks: (n?: number) => TrackSnapshot[];
};

function readDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => resolve(isFinite(a.duration) ? Math.round(a.duration) : 0);
    a.onerror = () => resolve(0);
    a.src = url;
  });
}

export const useLocal = create<LocalState>()(
  persist(
    (set, get) => ({
      history: [],
      counts: {},
      downloads: {},
      progress: {},
      local: {},
      recentSearches: [],
      recognitions: [],
      settings: { fade: 0, dynamicTheme: true, autoLyrics: false, dataSaver: false, accentColor: DEFAULT_ACCENT },

      recordPlay: (track) => {
        const snap = toSnapshot(track);
        const { history, counts } = get();
        if (history[0]?.track.id === snap.id && Date.now() - history[0].at < 60_000) return;
        const c = counts[snap.id];
        set({
          history: [{ track: snap, at: Date.now() }, ...history.filter((h) => h.track.id !== snap.id)].slice(0, 200),
          counts: { ...counts, [snap.id]: { track: snap, n: (c?.n ?? 0) + 1, last: Date.now() } },
        });
      },
      clearHistory: () => set({ history: [], counts: {} }),

      download: async (track, notify) => {
        const { downloads, progress } = get();
        if (downloads[track.id] || progress[track.id] !== undefined || track.id.startsWith("local:")) return;
        set((s) => ({ progress: { ...s.progress, [track.id]: 0 } }));
        try {
          const res = await fetch(streamPath(track.id));
          if (!res.ok || !res.body) throw new Error("stream unavailable");
          const total = Number(res.headers.get("content-length")) || 0;
          const reader = res.body.getReader();
          const chunks: BlobPart[] = [];
          let got = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value as BlobPart);
            got += value.length;
            if (total) set((s) => ({ progress: { ...s.progress, [track.id]: got / total } }));
          }
          if (!got) throw new Error("empty stream");
          const blob = new Blob(chunks, { type: res.headers.get("content-type") ?? "audio/mp4" });
          await putBlob(track.id, blob);
          // Only list the track as offline once the bytes are verifiably stored,
          // otherwise a click in the Offline section would find nothing to play.
          if (!(await hasBlob(track.id))) throw new Error("offline storage write failed");
          set((s) => ({ downloads: { ...s.downloads, [track.id]: { track: toSnapshot(track), size: blob.size, at: Date.now() } } }));
          notify?.(`Downloaded "${track.title}"`);
        } catch {
          notify?.("Download failed");
        } finally {
          set((s) => {
            const p = { ...s.progress };
            delete p[track.id];
            return { progress: p };
          });
        }
      },
      removeDownload: async (id) => {
        await deleteBlob(id).catch(() => {});
        set((s) => {
          const d = { ...s.downloads };
          delete d[id];
          return { downloads: d };
        });
      },

      importLocal: async (files, notify) => {
        let added = 0;
        for (const file of Array.from(files)) {
          if (!file.type.startsWith("audio/") && !/\.(mp3|m4a|aac|flac|wav|ogg|opus)$/i.test(file.name)) continue;
          const id = `local:${crypto.randomUUID()}`;
          const url = URL.createObjectURL(file);
          const duration = await readDuration(url);
          URL.revokeObjectURL(url);
          try {
            await putBlob(id, file);
          } catch {
            notify?.("Offline storage unavailable");
            return;
          }
          const base = file.name.replace(/\.[^.]+$/, "");
          const [artist, title] = base.includes(" - ") ? base.split(" - ", 2) : ["Local file", base];
          const track: TrackSnapshot = { id, title: title.trim(), artist: artist.trim(), artistId: "", artwork: null, duration, genre: null, album: null, albumId: null };
          set((s) => ({ local: { ...s.local, [id]: { track, size: file.size, at: Date.now(), name: file.name } } }));
          added++;
        }
        notify?.(added ? `Imported ${added} ${added === 1 ? "file" : "files"}` : "No audio files found");
      },
      removeLocal: async (id) => {
        await deleteBlob(id).catch(() => {});
        set((s) => {
          const l = { ...s.local };
          delete l[id];
          return { local: l };
        });
      },

      addSearch: (q) => {
        const v = q.trim();
        if (!v) return;
        set((s) => ({ recentSearches: [v, ...s.recentSearches.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 10) }));
      },
      addRecognition: (r) => set((s) => ({ recognitions: [r, ...s.recognitions].slice(0, 30) })),
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      topTracks: (n = 50) =>
        Object.values(get().counts)
          .sort((a, b) => b.n - a.n || b.last - a.last)
          .slice(0, n)
          .map((c) => c.track),
    }),
    {
      name: "echo-local-v1",
      partialize: (s) => ({
        history: s.history,
        counts: s.counts,
        downloads: s.downloads,
        local: s.local,
        recentSearches: s.recentSearches,
        recognitions: s.recognitions,
        settings: s.settings,
      }),
    },
  ),
);
