/**
 * ┌──────────────────────────┐
 * │      ytmusic-api         │   Layer 1 — Search / Metadata / Artist / Album / ID
 * └──────────────────────────┘
 *
 * Catalog provider backed by the server-side music catalog package (the provider's
 * InnerTube API, no key required). Every track's `id` is a catalog video id,
 * which is what the Audio Stream Resolver (src/lib/resolver.ts) turns into a
 * playable stream.
 */
import "server-only";
import YTMusic, {
  type AlbumDetailed,
  type ArtistDetailed,
  type PlaylistDetailed,
  type SongDetailed,
  type ThumbnailFull,
  type VideoDetailed,
} from "ytmusic-api";

/** Shape returned by YTMusic.getUpNexts (not exported from the package entry). */
type UpNext = Awaited<ReturnType<YTMusic["getUpNexts"]>>[number];
import type { Artist, Collection, Track } from "@/lib/types";

export type { Artist, Collection, Track } from "@/lib/types";
export { formatDuration, fromSnapshot, streamPath, toSnapshot } from "@/lib/types";

export interface MusicProvider {
  search(query: string): Promise<{ tracks: Track[]; artists: Artist[]; collections: Collection[] }>;
  trending(opts?: { genre?: string }): Promise<Track[]>;
  homeSections(): Promise<{ title: string; subtitle: string; tracks: Track[] }[]>;
  track(id: string): Promise<Track | null>;
  /** Single Up-Next call — ~30 tracks, cheap. */
  related(id: string): Promise<Track[]>;
  /** Infinite-radio mode — chained + fan-out Up-Next calls for 100+ tracks. */
  radio(id: string, opts?: { limit?: number; fanout?: number }): Promise<Track[]>;
  artist(id: string): Promise<{ artist: Artist; tracks: Track[]; albums: Collection[] } | null>;
  collection(id: string): Promise<{ collection: Collection; tracks: Track[] } | null>;
}

/* ------------------------------------------------------------------ */
/* Client singleton (survives HMR via globalThis, re-inits on failure)  */
/* ------------------------------------------------------------------ */
const g = globalThis as typeof globalThis & { __beatlyYtm?: Promise<YTMusic> | null };

function getClient(): Promise<YTMusic> {
  if (!g.__beatlyYtm) {
    g.__beatlyYtm = (async () => {
      const ytm = new YTMusic();
      await ytm.initialize();
      return ytm;
    })().catch((e) => {
      g.__beatlyYtm = null;
      throw e;
    });
  }
  return g.__beatlyYtm;
}

async function withClient<T>(fn: (ytm: YTMusic) => Promise<T>): Promise<T> {
  try {
    return await fn(await getClient());
  } catch (first) {
    // Session may have gone stale — rebuild the client once and retry.
    g.__beatlyYtm = null;
    try {
      return await fn(await getClient());
    } catch {
      throw first;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Mapping helpers                                                      */
/* ------------------------------------------------------------------ */
function bestThumb(thumbs: ThumbnailFull[] | undefined, size = 544): string | null {
  if (!thumbs?.length) return null;
  const largest = [...thumbs].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const url = largest.url;
  // Google user-content thumbnails accept arbitrary sizes via the =wXXX-hXXX suffix.
  if (/=w\d+-h\d+/.test(url)) return url.replace(/=w\d+-h\d+[^&]*/, `=w${size}-h${size}-l90-rj`);
  return url;
}

function mapSong(s: SongDetailed | VideoDetailed): Track | null {
  if (!s.videoId) return null;
  const album = "album" in s && s.album ? s.album : null;
  return {
    id: s.videoId,
    videoId: s.videoId,
    title: s.name?.trim() || "Unknown title",
    artist: s.artist?.name?.trim() || "Unknown artist",
    artistId: s.artist?.artistId ?? "",
    artwork: bestThumb(s.thumbnails),
    duration: typeof s.duration === "number" && s.duration > 0 ? s.duration : 0,
    genre: null,
    album: album?.name ?? null,
    albumId: album?.albumId ?? null,
  };
}

function mapSongs(list: Array<SongDetailed | VideoDetailed> | undefined): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const s of list ?? []) {
    const t = mapSong(s);
    if (t && !seen.has(t.id)) {
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
}

function mapArtist(a: ArtistDetailed): Artist {
  return {
    id: a.artistId,
    name: a.name,
    handle: "",
    avatar: bestThumb(a.thumbnails),
    cover: bestThumb(a.thumbnails, 1200),
    bio: null,
    followers: 0,
    trackCount: 0,
  };
}

function mapAlbum(a: AlbumDetailed): Collection {
  return {
    id: a.albumId,
    name: a.name,
    artist: a.artist?.name ?? "",
    artwork: bestThumb(a.thumbnails),
    trackCount: 0,
    isAlbum: true,
    year: a.year ?? null,
  };
}

function mapPlaylist(p: PlaylistDetailed): Collection {
  return {
    id: p.playlistId,
    name: p.name,
    artist: p.artist?.name ?? "Beatly Mix",
    artwork: bestThumb(p.thumbnails),
    trackCount: 0,
    isAlbum: false,
    year: null,
  };
}

const isAlbumId = (id: string) => id.startsWith("MPREb");

/* ------------------------------------------------------------------ */
/* Provider                                                             */
/* ------------------------------------------------------------------ */
/**
 * Normalise the runtime shape of getUpNexts results and dedupe against an
 * optional shared `seen` set. The ytmusic-api typings don't match the real
 * payload (artists is a string, duration is "m:ss", artwork is a single URL),
 * so we handle every variant defensively.
 */
function mapUpNextList(
  list: UpNext[],
  skipVideoId: string | null,
  limit: number,
  seen: Set<string> = new Set(),
): Track[] {
  const out: Track[] = [];
  for (const raw of list ?? []) {
    const u = raw as unknown as {
      videoId?: string;
      title?: string;
      artists?: unknown;
      duration?: unknown;
      thumbnail?: unknown;
      thumbnails?: ThumbnailFull[];
    };
    if (!u.videoId || seen.has(u.videoId) || u.videoId === skipVideoId) continue;
    seen.add(u.videoId);

    let artistName = "Unknown artist";
    if (typeof u.artists === "string" && u.artists.trim()) artistName = u.artists.trim();
    else if (u.artists && typeof u.artists === "object" && "name" in (u.artists as object)) {
      artistName = String((u.artists as { name?: unknown }).name ?? "").trim() || "Unknown artist";
    }

    let duration = 0;
    if (typeof u.duration === "number" && u.duration > 0) duration = u.duration;
    else if (typeof u.duration === "string") {
      const m = /^(\d+):(\d{1,2})$/.exec(u.duration.trim());
      if (m) duration = Number(m[1]) * 60 + Number(m[2]);
    }

    const artwork =
      typeof u.thumbnail === "string" && u.thumbnail.trim() ? u.thumbnail : bestThumb(u.thumbnails);

    out.push({
      id: u.videoId,
      videoId: u.videoId,
      title: u.title?.trim() || "Unknown title",
      artist: artistName,
      artistId: "",
      artwork,
      duration,
      genre: null,
      album: null,
      albumId: null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

const ytMusicProvider: MusicProvider = {
  async search(query) {
    const q = query.trim();
    if (!q) return { tracks: [], artists: [], collections: [] };
    const [songs, artists, albums, playlists] = await Promise.all([
      withClient((y) => y.searchSongs(q)).catch(() => [] as SongDetailed[]),
      withClient((y) => y.searchArtists(q)).catch(() => [] as ArtistDetailed[]),
      withClient((y) => y.searchAlbums(q)).catch(() => [] as AlbumDetailed[]),
      withClient((y) => y.searchPlaylists(q)).catch(() => [] as PlaylistDetailed[]),
    ]);
    return {
      tracks: mapSongs(songs),
      artists: artists.filter((a) => a.artistId).map(mapArtist).slice(0, 10),
      collections: [...albums.map(mapAlbum).slice(0, 10), ...playlists.map(mapPlaylist).slice(0, 10)],
    };
  },

  async trending(opts = {}) {
    const songs = await withClient((y) => y.searchSongs(opts.genre?.trim() || "top hits"));
    return mapSongs(songs);
  },

  async homeSections() {
    const defs = [
      { title: "Trending now", subtitle: "Today's biggest songs", q: "top hits 2026" },
      { title: "Hip-Hop", subtitle: "Chart-topping rap", q: "hip hop hits" },
      { title: "Pop", subtitle: "Pop essentials", q: "pop hits" },
      { title: "Electronic", subtitle: "Dance & EDM", q: "edm hits" },
      { title: "R&B", subtitle: "Smooth & soulful", q: "r&b hits" },
      { title: "Chill / Lo-Fi", subtitle: "Beats to relax to", q: "lofi chill beats" },
    ];
    const results = await Promise.all(
      defs.map(async (d) => ({ ...d, tracks: await this.trending({ genre: d.q }).catch(() => [] as Track[]) })),
    );
    return results.filter((r) => r.tracks.length > 0);
  },

  async track(id) {
    try {
      const s = await withClient((y) => y.getSong(id));
      return mapSong({ ...s, type: "SONG", album: undefined } as unknown as SongDetailed);
    } catch {
      return null;
    }
  },

  /**
   * Single Up-Next call for a given video id. Cheap — one round trip, ~30
   * tracks. Used by callers that just need a shallow radio.
   */
  async related(id) {
    const list = await withClient((y) => y.getUpNexts(id)).catch(() => [] as UpNext[]);
    return mapUpNextList(list ?? [], id, 30);
  },

  /**
   * Infinite-radio mode: chain parallel Up-Next calls to accumulate a deep,
   * genuine related list. Strategy:
   *
   *   1. Seed:     getUpNexts(seed)            → ~49 tracks
   *   2. Fan-out:  getUpNexts(top-N of seed)   → ~49 tracks each, parallel
   *   3. Dedupe across the pool, trim to `limit` (max 200).
   *
   * Any individual Up-Next call is best-effort; failures just shrink the pool
   * rather than aborting the whole radio. The returned array preserves the
   * seed-relative order so the first songs are the closest matches.
   */
  async radio(id, opts = {}) {
    const limit = Math.min(200, Math.max(20, opts.limit ?? 120));
    const fanout = Math.min(8, Math.max(0, opts.fanout ?? 4));

    let seed: UpNext[] = [];
    try {
      seed = (await withClient((y) => y.getUpNexts(id))) ?? [];
    } catch {
      return [];
    }
    if (!seed.length) return [];

    // Pick the top-N fan-out IDs BEFORE the seed's results get deduped into
    // `seen` — otherwise the filter below would drop every candidate.
    const fanIds = seed
      .slice(0, fanout)
      .map((s) => (s as unknown as { videoId?: string }).videoId)
      .filter((x): x is string => !!x && x !== id);

    const seen = new Set<string>([id]);
    const collected = mapUpNextList(seed, id, limit, seen);
    if (collected.length >= limit || fanout === 0) return collected;

    // Parallel fan-out over the top-N related tracks. We race against a
    // ceiling timeout so a single slow call can't stall the whole radio.
    const settled = await Promise.allSettled(
      fanIds.map((fid) =>
        Promise.race([
          withClient((y) => y.getUpNexts(fid)),
          new Promise<UpNext[]>((resolve) => setTimeout(() => resolve([]), 6000)),
        ]),
      ),
    );
    for (const result of settled) {
      if (result.status !== "fulfilled") continue;
      for (const t of mapUpNextList(result.value ?? [], id, limit - collected.length, seen)) {
        collected.push(t);
        if (collected.length >= limit) return collected;
      }
    }
    return collected;
  },

  async artist(id) {
    try {
      const full = await withClient((y) => y.getArtist(id));
      const more = await withClient((y) => y.getArtistSongs(id)).catch(() => [] as SongDetailed[]);
      const tracks = mapSongs([...(full.topSongs ?? []), ...more]);
      const albums = [...(full.topAlbums ?? []), ...(full.topSingles ?? [])].map(mapAlbum);
      const seen = new Set<string>();
      return {
        artist: {
          id: full.artistId,
          name: full.name,
          handle: "",
          avatar: bestThumb(full.thumbnails),
          cover: bestThumb(full.thumbnails, 1200),
          bio: null,
          followers: 0,
          trackCount: tracks.length,
        },
        tracks,
        albums: albums.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true))),
      };
    } catch {
      return null;
    }
  },

  async collection(id) {
    try {
      if (isAlbumId(id)) {
        const album = await withClient((y) => y.getAlbum(id));
        const tracks = mapSongs(album.songs).map((t) => ({
          ...t,
          album: album.name,
          albumId: album.albumId,
          artwork: t.artwork ?? bestThumb(album.thumbnails),
        }));
        return {
          collection: {
            id: album.albumId,
            name: album.name,
            artist: album.artist?.name ?? "",
            artwork: bestThumb(album.thumbnails),
            trackCount: tracks.length,
            isAlbum: true,
            year: album.year ?? null,
          },
          tracks,
        };
      }
      const [pl, videos] = await Promise.all([
        withClient((y) => y.getPlaylist(id)),
        withClient((y) => y.getPlaylistVideos(id)).catch(() => [] as VideoDetailed[]),
      ]);
      const tracks = mapSongs(videos);
      return {
        collection: {
          id: pl.playlistId,
          name: pl.name,
          artist: pl.artist?.name ?? "Beatly Mix",
          artwork: bestThumb(pl.thumbnails) ?? tracks[0]?.artwork ?? null,
          trackCount: tracks.length || pl.videoCount || 0,
          isAlbum: false,
          year: null,
        },
        tracks,
      };
    } catch {
      return null;
    }
  },
};

export function getProvider(): MusicProvider {
  return ytMusicProvider;
}

