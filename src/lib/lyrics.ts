/** Synced lyrics via the public LRCLIB API (CORS-enabled, no key). Client-only. */
export type LyricLine = { t: number; text: string };
export type Lyrics = { synced: LyricLine[] | null; plain: string | null; source: string };

const cache = new Map<string, Promise<Lyrics | null>>();

function clean(title: string) {
  return title
    .replace(/\s*[\(\[][^\)\]]*(official|video|audio|lyric|visualizer|remaster|feat\.?|ft\.?|prod\.?)[^\)\]]*[\)\]]/gi, "")
    .replace(/\s*[-–|]\s*(official|lyrics?|audio|video).*$/i, "")
    .trim();
}

export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const times = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!times.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, "").trim();
    for (const m of times) {
      const ms = m[3] ? Number(m[3].padEnd(3, "0").slice(0, 3)) : 0;
      out.push({ t: Number(m[1]) * 60 + Number(m[2]) + ms / 1000, text });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

export type LyricLang = { code: string; label: string; flag: string };

/** Languages offered by the lyrics switcher. `original` = as-published. */
export const LYRICS_LANGUAGES: LyricLang[] = [
  { code: "original", label: "Original", flag: "🎵" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "hi", label: "Hindi", flag: "🇮🇳" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "pt", label: "Portuguese", flag: "🇵🇹" },
  { code: "pa", label: "Punjabi", flag: "🇮🇳" },
  { code: "ta", label: "Tamil", flag: "🇮🇳" },
  { code: "te", label: "Telugu", flag: "🇮🇳" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "romaji", label: "Romaji", flag: "🔤" },
];

const translateCache = new Map<string, Promise<string[]>>();

/**
 * Translate lyric lines server-side (batched, cached). Returns translated
 * strings in the same order — timestamps stay untouched so sync is preserved.
 */
export function translateLyrics(texts: string[], target: string): Promise<string[]> {
  if (target === "original") return Promise.resolve(texts);
  const key = `${target}::${texts.join("\n")}`;
  const hit = translateCache.get(key);
  if (hit) return hit;
  const p = (async () => {
    const res = await fetch("/api/lyrics/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, target }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`translate ${res.status}`);
    const json = (await res.json()) as { translations?: string[] };
    if (!Array.isArray(json.translations) || json.translations.length !== texts.length) {
      throw new Error("translate shape mismatch");
    }
    return json.translations;
  })();
  // Don't cache failures forever — drop rejections so a retry can succeed.
  p.catch(() => translateCache.delete(key));
  translateCache.set(key, p);
  if (translateCache.size > 60) {
    const oldest = translateCache.keys().next().value;
    if (oldest !== undefined) translateCache.delete(oldest);
  }
  return p;
}

type LrcRecord = { syncedLyrics?: string | null; plainLyrics?: string | null; duration?: number };

export function fetchLyrics(track: { title: string; artist: string; album?: string | null; duration: number }): Promise<Lyrics | null> {
  const k = `${track.title}|${track.artist}|${track.duration}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const p = (async () => {
    const title = clean(track.title);
    const artist = track.artist.replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").trim();
    const pick = (r: LrcRecord | null | undefined): Lyrics | null =>
      r && (r.syncedLyrics || r.plainLyrics)
        ? { synced: r.syncedLyrics ? parseLrc(r.syncedLyrics) : null, plain: r.plainLyrics ?? null, source: "LRCLIB" }
        : null;
    try {
      const params = new URLSearchParams({ track_name: title, artist_name: artist });
      if (track.album) params.set("album_name", track.album);
      if (track.duration) params.set("duration", String(Math.round(track.duration)));
      const res = await fetch(`https://lrclib.net/api/get?${params}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const got = pick((await res.json()) as LrcRecord);
        if (got) return got;
      }
    } catch {
      /* fall through to search */
    }
    try {
      const params = new URLSearchParams({ track_name: title, artist_name: artist });
      const res = await fetch(`https://lrclib.net/api/search?${params}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const list = (await res.json()) as LrcRecord[];
      const best =
        list.find((r) => r.syncedLyrics && track.duration && Math.abs((r.duration ?? 0) - track.duration) < 8) ??
        list.find((r) => r.syncedLyrics) ??
        list.find((r) => r.plainLyrics);
      return pick(best);
    } catch {
      return null;
    }
  })();
  cache.set(k, p);
  return p;
}
