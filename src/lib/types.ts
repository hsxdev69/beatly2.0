/**
 * Client-safe shared types & helpers (no server imports).
 */
import type { TrackSnapshot } from "@/db/schema";

export type Track = TrackSnapshot & {
  /** YouTube video id (same as `id`) — input to the Audio Stream Resolver. */
  videoId: string;
};

export type Artist = {
  id: string;
  name: string;
  handle: string;
  avatar: string | null;
  cover: string | null;
  bio: string | null;
  followers: number;
  trackCount: number;
};

export type Collection = {
  id: string;
  name: string;
  artist: string;
  artwork: string | null;
  trackCount: number;
  isAlbum: boolean;
  year: number | null;
};

/** Song ID → playable URL served by the Audio Stream Resolver route. */
export function streamPath(videoId: string, fresh = false): string {
  return `/api/stream/${encodeURIComponent(videoId)}${fresh ? "?fresh=1" : ""}`;
}

/**
 * Rehydrate a stored snapshot (likes, playlists, downloads, local files,
 * history) into a playable Track. Always guarantees the fields the player
 * pipeline needs — `videoId`, `title`, `artist`, `artwork` — even for records
 * persisted by older builds that lacked them.
 */
export function fromSnapshot(s: TrackSnapshot): Track {
  const raw = s as TrackSnapshot & { videoId?: string; thumbnailUrl?: string | null };
  const id = String(raw.id ?? raw.videoId ?? "");
  return {
    ...s,
    id,
    videoId: raw.videoId || id,
    title: raw.title || "Unknown title",
    artist: raw.artist || "Unknown artist",
    artistId: raw.artistId ?? "",
    artwork: raw.artwork ?? raw.thumbnailUrl ?? null,
    duration: typeof raw.duration === "number" ? raw.duration : 0,
    genre: raw.genre ?? null,
    album: raw.album ?? null,
    albumId: raw.albumId ?? null,
  };
}

export function toSnapshot(t: Track): TrackSnapshot {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    artistId: t.artistId,
    artwork: t.artwork,
    duration: t.duration,
    genre: t.genre ?? null,
    album: t.album ?? null,
    albumId: t.albumId ?? null,
  };
}

export function formatDuration(sec: number): string {
  if (!sec || !isFinite(sec)) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export type HomeSectionType =
  | "featured"
  | "speed_dial"
  | "songs"
  | "songs_large"
  | "albums"
  | "artists"
  | "banners"
  | "languages";

export type HomeSection = {
  id: string;
  title: string;
  subtitle?: string;
  kicker?: string;
  type: HomeSectionType;
  items: Track[];
  artists?: Artist[];
  albums?: Collection[];
  badge?: string;
  accent?: string;
  moreHref?: string;
};

export type IndianHomeData = {
  sections: HomeSection[];
  hero: Track[];
  featuredToday: Track | null;
  generatedAt: number;
  seed: number;
};
