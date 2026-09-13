/**
 * ┌─────────────────────────────────────────────────────────┐
 * │  Genre-Locked Home Feed — Romantic-by-Default Engine    │
 * └─────────────────────────────────────────────────────────┘
 *
 * CRITICAL BEHAVIOR:
 *   - Default (no chip clicked): the home feed MUST exclusively fetch and
 *     display Romantic songs. No trending/mixed/other-genre content is
 *     ever mixed into this default view.
 *   - The feed only ever switches away from Romantic when the caller
 *     explicitly passes a different `genre` slug (i.e. the user clicked a
 *     specific genre/mood/language chip). There is no implicit fallback to
 *     a "mixed" feed.
 *
 * Reuses the exact same `getProvider().trending({ genre })` call already
 * used by the existing `/mood/[slug]` pages — no changes to the catalog
 * layer (`src/lib/music.ts`) or ytmusic-api integration were required.
 */
import "server-only";
import { getProvider } from "@/lib/music";
import { findMood, MOODS } from "@/lib/moods";
import type { HomeSection, IndianHomeData, Track } from "@/lib/types";

export const DEFAULT_GENRE = "romance";

type CacheEntry = { data: IndianHomeData; expiresAt: number };
const g = globalThis as typeof globalThis & { __genreFeedCache?: Map<string, CacheEntry> };
const cache = (g.__genreFeedCache ??= new Map());
const CACHE_TTL_MS = 6 * 60 * 1000;

type RomanticSectionDef = {
  id: string;
  title: string;
  subtitle: string;
  kicker: string;
  queries: string[];
};

/**
 * Curated Romantic-only query variants. Every single one of these queries
 * is a romantic/love-song search — there is intentionally no "trending" or
 * generic query mixed in here, so the default feed can never contain
 * non-romantic tracks.
 */
const ROMANTIC_SECTIONS: RomanticSectionDef[] = [
  {
    id: "romantic_hits",
    title: "Romantic Hits",
    subtitle: "Chart-topping love songs",
    kicker: "💕 Top Picks",
    queries: ["romantic hits love songs 2026", "top romantic Hindi songs", "Bollywood romantic hits"],
  },
  {
    id: "love_ballads",
    title: "Love Ballads",
    subtitle: "Soulful ballads for the heart",
    kicker: "💗 Soulful",
    queries: ["romantic ballads Bollywood", "Arijit Singh love songs", "soulful Hindi love songs"],
  },
  {
    id: "slow_romantic",
    title: "Slow & Romantic",
    subtitle: "Mellow melodies for quiet moments",
    kicker: "🌹 Mellow",
    queries: ["slow romantic songs hindi", "romantic unplugged love songs", "soft romantic Bollywood songs"],
  },
  {
    id: "love_songs_mix",
    title: "Love Songs Mix",
    subtitle: "A curated mix of love songs across languages",
    kicker: "🎵 Mixtape",
    queries: ["romantic love songs mix India", "romantic Punjabi Tamil Telugu songs", "best love songs playlist"],
  },
];

async function fetchSafeTracks(query: string, timeoutMs = 5000): Promise<Track[]> {
  try {
    const provider = getProvider();
    return await Promise.race([
      provider.trending({ genre: query }),
      new Promise<Track[]>((resolve) => setTimeout(() => resolve([]), timeoutMs)),
    ]);
  } catch {
    return [];
  }
}

/** Dedupe helper shared by both feed builders below. */
function dedupeTracks(raw: Track[], usedTrackIds: Set<string>, minFill = 6, maxFill = 8): Track[] {
  const unique: Track[] = [];
  for (const t of raw) {
    if (!usedTrackIds.has(t.id)) {
      usedTrackIds.add(t.id);
      unique.push(t);
    }
  }
  // Only backfill with (locally) repeated tracks if a query genuinely
  // returned too few unique results — keeps sections from looking sparse.
  if (unique.length < minFill) {
    for (const t of raw) {
      if (!unique.some((u) => u.id === t.id)) unique.push(t);
      if (unique.length >= maxFill) break;
    }
  }
  return unique;
}

/**
 * The strict Romantic-only feed. This is what loads on initial app load,
 * on plain page refresh, and whenever no genre/mood/language chip is
 * actively selected.
 */
export async function getRomanticFeed(seed = 0): Promise<IndianHomeData> {
  const cacheKey = `romance_${((seed % 4) + 4) % 4}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.data;

  const usedTrackIds = new Set<string>();
  const sections: HomeSection[] = [];
  let heroTracks: Track[] = [];

  for (let i = 0; i < ROMANTIC_SECTIONS.length; i++) {
    const def = ROMANTIC_SECTIONS[i];
    const queryIndex = (seed + i) % def.queries.length;
    const raw = await fetchSafeTracks(def.queries[queryIndex]);
    const unique = dedupeTracks(raw, usedTrackIds);
    if (unique.length === 0) continue;

    if (i === 0) heroTracks = unique;
    sections.push({
      id: def.id,
      title: def.title,
      subtitle: def.subtitle,
      kicker: def.kicker,
      type: i === 0 ? "featured" : "songs",
      items: unique.slice(0, 16),
      accent: "#f43f5e",
    });
  }

  const featuredToday = heroTracks.length ? heroTracks[seed % heroTracks.length] : null;
  const data: IndianHomeData = { sections, hero: heroTracks, featuredToday, generatedAt: Date.now(), seed };
  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

/**
 * Single genre/mood/language feed — used ONLY when the user explicitly taps
 * a specific chip that is not the default Romantic chip. Falls back to the
 * Romantic feed if the slug can't be resolved (never falls back to a mixed
 * feed), preserving the "always romantic unless explicitly chosen" rule.
 */
export async function getMoodFeed(slug: string, seed = 0): Promise<IndianHomeData> {
  if (slug === DEFAULT_GENRE) return getRomanticFeed(seed);

  const mood = findMood(slug) ?? MOODS.find((m) => m.slug === DEFAULT_GENRE);
  if (!mood) return getRomanticFeed(seed);
  if (mood.slug === DEFAULT_GENRE) return getRomanticFeed(seed);

  const cacheKey = `mood_${mood.slug}_${((seed % 4) + 4) % 4}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.data;

  const variants = [mood.q, `${mood.label} top songs`, `best ${mood.label} hits`, `${mood.label} playlist 2026`];
  const usedTrackIds = new Set<string>();
  const sections: HomeSection[] = [];
  let heroTracks: Track[] = [];

  const SECTION_COUNT = 3;
  for (let i = 0; i < SECTION_COUNT; i++) {
    const q = variants[(seed + i) % variants.length];
    const raw = await fetchSafeTracks(q);
    const unique = dedupeTracks(raw, usedTrackIds);
    if (unique.length === 0) continue;

    if (i === 0) heroTracks = unique;
    sections.push({
      id: `${mood.slug}_section_${i}`,
      title: i === 0 ? `${mood.label} Hits` : i === 1 ? `More ${mood.label}` : `${mood.label} Mix`,
      subtitle: i === 0 ? `Top ${mood.label} tracks` : undefined,
      kicker: `${mood.emoji} ${mood.label}`,
      type: i === 0 ? "featured" : "songs",
      items: unique.slice(0, 16),
      accent: mood.from,
    });
  }

  const featuredToday = heroTracks[0] ?? null;
  const data: IndianHomeData = { sections, hero: heroTracks, featuredToday, generatedAt: Date.now(), seed };
  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}
