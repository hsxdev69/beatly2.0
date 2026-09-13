/**
 * ┌─────────────────────────────────────────────────────────┐
 * │  Indian Music Discovery Engine — Section Generator      │
 * └─────────────────────────────────────────────────────────┘
 *
 * Generates 15–20 dynamic music sections centered on Indian music
 * (Hindi, Marathi, Punjabi, Tamil, Telugu, Bengali, Kannada, Malayalam,
 *  Gujarati, Bhojpuri, Haryanvi, Indian Independent).
 *
 * Features:
 *   - Global deduplication: tracks are unique across sections (usedTrackIds set)
 *   - Query variation: multiple query strategies per category rotated by seed
 *   - Layout diversity: featured cards, speed dial, song shelves, large cards,
 *     album rows, artist spotlight, banners, and language explorer
 *   - Resilient: individual section errors fall back gracefully
 *   - In-memory TTL cache for speed and rate-limit protection
 */
import "server-only";
import { getProvider } from "@/lib/music";
import type { Artist, Collection, HomeSection, IndianHomeData, Track } from "@/lib/types";

// Cache store keyed by seed mod 5, with 8 minute TTL
type CacheEntry = { data: IndianHomeData; expiresAt: number };
const g = globalThis as typeof globalThis & { __indianHomeCache?: Map<string, CacheEntry> };
const cache = (g.__indianHomeCache ??= new Map());
const CACHE_TTL_MS = 8 * 60 * 1000;

type SectionDef = {
  id: string;
  title: string;
  subtitle?: string;
  kicker?: string;
  type: HomeSection["type"];
  badge?: string;
  accent?: string;
  moreHref?: string;
  queries: string[];
};

// 20 rich Indian Music discovery sections
const INDIAN_SECTION_DEFS: SectionDef[] = [
  {
    id: "trending_india",
    title: "Trending in India",
    subtitle: "Top charts & viral hits across the nation",
    kicker: "Trending Now",
    type: "featured",
    badge: "🔥 Top Trending",
    accent: "#ff4f8b",
    moreHref: "/mood/bollywood-hitlist",
    queries: [
      "Trending Indian songs 2026",
      "Top 50 India music charts",
      "India top trending songs",
      "Hottest Hindi trending music",
    ],
  },
  {
    id: "made_for_india",
    title: "Made for India",
    subtitle: "Essential tracks shaping India's soundscape",
    kicker: "Pan-India Mix",
    type: "speed_dial",
    badge: "🇮🇳 All India",
    accent: "#e11d48",
    queries: [
      "Best Indian songs playlist 2026",
      "India biggest hits hindi punjabi",
      "Top Indian anthems",
      "Indian chartbusters 2026",
    ],
  },
  {
    id: "fresh_releases",
    title: "Fresh Releases",
    subtitle: "Brand new singles & album drops",
    kicker: "Just Dropped",
    type: "songs",
    badge: "🎧 New Music",
    accent: "#06b6d4",
    queries: [
      "New Hindi songs 2026",
      "Latest Bollywood song releases",
      "Fresh Indian music singles 2026",
      "New Indian pop releases",
    ],
  },
  {
    id: "hindi_hits",
    title: "Hindi Hits",
    subtitle: "The biggest Bollywood & Hindi pop anthems",
    kicker: "Bollywood Peak",
    type: "songs_large",
    badge: "🎤 Top Hindi",
    accent: "#e11d48",
    moreHref: "/mood/hindi",
    queries: [
      "Hindi top songs 2026",
      "Bollywood top hits",
      "Latest Hindi romantic party songs",
      "Bollywood blockbuster songs",
    ],
  },
  {
    id: "bollywood_party",
    title: "Bollywood Party",
    subtitle: "High-octane club beats & sangeet anthems",
    kicker: "Turn It Up",
    type: "banners",
    badge: "🪩 Dance Floor",
    accent: "#f59e0b",
    moreHref: "/mood/bollywood-fire",
    queries: [
      "Bollywood party dance hits",
      "Hindi club party mashup",
      "Bollywood dance songs wedding",
      "Bollywood party anthems",
    ],
  },
  {
    id: "romantic_bollywood",
    title: "Romantic Bollywood",
    subtitle: "Soulful love ballads for the heart",
    kicker: "Pure Romance",
    type: "songs",
    badge: "💕 Love Notes",
    accent: "#f43f5e",
    moreHref: "/mood/romance",
    queries: [
      "Romantic Hindi love songs 2026",
      "Bollywood romantic ballads",
      "Arijit Singh love songs",
      "Soulful Hindi romance hits",
    ],
  },
  {
    id: "chill_latenight",
    title: "Chill & Late Night",
    subtitle: "Acoustic, lofi & mellow midnight vibes",
    kicker: "Midnight Sessions",
    type: "songs",
    badge: "🌙 Calm & Cozy",
    accent: "#3b82f6",
    moreHref: "/mood/chill",
    queries: [
      "Bollywood acoustic unplugged songs",
      "Hindi chill lofi beats",
      "Late night drive Hindi songs",
      "Indian acoustic soft songs",
    ],
  },
  {
    id: "marathi_hits",
    title: "Marathi Hits",
    subtitle: "Zingaat energy, Bhavgeet & modern Marathi pop",
    kicker: "Maharashtra Beats",
    type: "songs",
    badge: "🎶 Marathi Swag",
    accent: "#059669",
    moreHref: "/mood/marathi",
    queries: [
      "Marathi top hits songs",
      "Marathi romantic hits",
      "Ajay Atul Marathi songs",
      "Latest Marathi chartbusters",
    ],
  },
  {
    id: "punjabi_hits",
    title: "Punjabi Hits",
    subtitle: "Bhangra bangers, Dhol & Punjabi wave",
    kicker: "Desi Heat",
    type: "songs",
    badge: "🐯 Punjabi Wave",
    accent: "#d97706",
    moreHref: "/mood/punjabi",
    queries: [
      "Punjabi top hits songs",
      "Diljit Dosanjh Karan Aujla hits",
      "Punjabi viral songs",
      "Bhangra party Punjabi hits",
    ],
  },
  {
    id: "south_indian_hits",
    title: "South Indian Superhits",
    subtitle: "Tamil, Telugu, Kannada & Malayalam blockbusters",
    kicker: "Southern Fire",
    type: "songs_large",
    badge: "🌴 South Hits",
    accent: "#7c3aed",
    moreHref: "/mood/tamil",
    queries: [
      "Tamil Telugu Kannada Malayalam hits",
      "South Indian blockbuster songs",
      "Anirudh Sid Sriram hits",
      "Tamil and Telugu top songs 2026",
    ],
  },
  {
    id: "sad_emotional",
    title: "Sad & Emotional",
    subtitle: "Heartfelt heartbreak & soulful melodies",
    kicker: "Deep Feelings",
    type: "songs",
    badge: "🥀 Soulful Tears",
    accent: "#64748b",
    moreHref: "/mood/sad",
    queries: [
      "Sad emotional Hindi songs",
      "Bollywood heartbreak songs",
      "Soulful Indian sad melodies",
      "Hindi emotional ballads",
    ],
  },
  {
    id: "road_trip_india",
    title: "Road Trip India",
    subtitle: "Scenic highways, mountain passes & open roads",
    kicker: "Travel Anthems",
    type: "songs",
    badge: "🚗 On The Road",
    accent: "#10b981",
    moreHref: "/mood/road-trip",
    queries: [
      "Indian road trip travel songs",
      "Bollywood travel songs Dil Chahta Hai",
      "Hindi travel playlist upbeat",
      "Highway driving songs Hindi",
    ],
  },
  {
    id: "hidden_gems",
    title: "Hidden Gems (Indie India)",
    subtitle: "Independent voices, singer-songwriters & indie folk",
    kicker: "Under The Radar",
    type: "songs",
    badge: "💎 Indie Wave",
    accent: "#8b5cf6",
    moreHref: "/mood/indie",
    queries: [
      "Indian indie songs hindi",
      "Prateek Kuhad Anuv Jain indie",
      "Best Indian independent artists",
      "Indian indie acoustic pop",
    ],
  },
  {
    id: "new_and_rising",
    title: "New & Rising",
    subtitle: "Emerging breakout artists & fresh discoveries",
    kicker: "Next In Line",
    type: "songs",
    badge: "🆕 Fresh Voices",
    accent: "#ec4899",
    queries: [
      "New Indian breakout artists 2026",
      "Rising indie Indian music",
      "New Hindi indie singers",
      "Next big Indian music",
    ],
  },
  {
    id: "viral_indian",
    title: "Viral Indian Songs",
    subtitle: "Reels sensations & internet favorites",
    kicker: "Trending Online",
    type: "songs",
    badge: "🔥 Internet Hits",
    accent: "#ea580c",
    queries: [
      "Trending reels Hindi viral songs",
      "Viral Indian songs 2026",
      "Instagram trending songs India",
      "Viral reel music India",
    ],
  },
  {
    id: "dance_workout",
    title: "Dance & Workout India",
    subtitle: "High-BPM cardio beats & gym motivation",
    kicker: "Power Fuel",
    type: "songs",
    badge: "💃 High Energy",
    accent: "#ef4444",
    moreHref: "/mood/workout",
    queries: [
      "Bollywood workout gym songs",
      "High energy Hindi gym motivation",
      "Punjabi workout gym songs",
      "Bollywood cardio dance mix",
    ],
  },
  {
    id: "bollywood_classics",
    title: "Bollywood Classics",
    subtitle: "Golden era 90s & 2000s timeless nostalgia",
    kicker: "Evergreen Retro",
    type: "songs",
    badge: "🎬 Golden Era",
    accent: "#f59e0b",
    moreHref: "/mood/90s-bollywood-dance",
    queries: [
      "Bollywood 90s classic hits",
      "Best of 90s 2000s Bollywood",
      "Kishore Kumar Kumar Sanu Udit Narayan",
      "Classic Bollywood love songs 90s",
    ],
  },
  {
    id: "morning_india",
    title: "Morning India",
    subtitle: "Peaceful acoustic, sufi & meditative starts to the day",
    kicker: "Rise & Shine",
    type: "songs",
    badge: "🌅 Fresh Start",
    accent: "#f59e0b",
    queries: [
      "Morning acoustic Hindi calm songs",
      "Peaceful Hindi morning acoustic",
      "Sufi morning calm songs",
      "Indian morning positive vibes songs",
    ],
  },
];

// Curated Top Indian Artists for the Artist Spotlight
const SPOTLIGHT_ARTIST_NAMES = [
  "Arijit Singh",
  "Shreya Ghoshal",
  "Diljit Dosanjh",
  "Anirudh Ravichander",
  "Sid Sriram",
  "A.R. Rahman",
  "Darshan Raval",
  "Neha Kakkar",
  "Prateek Kuhad",
  "King",
  "Karan Aujla",
  "B Praak",
];

// Curated Iconic Soundtracks
const ICONIC_ALBUM_QUERIES = [
  "Animal soundtrack hindi",
  "Rockstar A.R. Rahman",
  "Aashiqui 2",
  "Kabir Singh",
  "Brahmastra album",
  "Yeh Jawaani Hai Deewani",
  "Sita Ramam telugu hindi",
];

/**
 * Fetch a single query's tracks safely with timeout and error fallback.
 */
async function fetchSafeTracks(query: string): Promise<Track[]> {
  try {
    const provider = getProvider();
    return await Promise.race([
      provider.trending({ genre: query }),
      new Promise<Track[]>((resolve) => setTimeout(() => resolve([]), 5000)),
    ]);
  } catch {
    return [];
  }
}

/**
 * Fetch top Indian artists for Spotlight section.
 */
async function fetchSpotlightArtists(): Promise<Artist[]> {
  try {
    const provider = getProvider();
    const results = await Promise.allSettled(
      SPOTLIGHT_ARTIST_NAMES.slice(0, 8).map(async (name) => {
        const data = await provider.search(name);
        return data.artists?.[0] ?? null;
      }),
    );
    return results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((a): a is Artist => !!a && !!a.id);
  } catch {
    return [];
  }
}

/**
 * Fetch iconic Indian soundtrack albums.
 */
async function fetchSoundtrackAlbums(): Promise<Collection[]> {
  try {
    const provider = getProvider();
    const results = await Promise.allSettled(
      ICONIC_ALBUM_QUERIES.map(async (q) => {
        const data = await provider.search(q);
        const album = data.collections?.find((c) => c.isAlbum) ?? data.collections?.[0];
        return album ?? null;
      }),
    );
    return results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((c): c is Collection => !!c && !!c.id);
  } catch {
    return [];
  }
}

/**
 * Main Indian Music Discovery Home Generator.
 *
 * Implements:
 *   - Global deduplication: `usedTrackIds = new Set<string>()`
 *   - Query rotation based on `seed`: pull-to-refresh yields different tracks
 *   - Error resilience: each section is isolated so single failures never break the page
 *   - In-memory cache keyed by seed
 */
export async function getIndianHomeData(opts: { seed?: number; refresh?: boolean } = {}): Promise<IndianHomeData> {
  const seed = opts.seed ?? 0;
  const cacheKey = `seed_${seed % 5}`;

  if (!opts.refresh) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.data;
    }
  }

  const usedTrackIds = new Set<string>();

  // 1. Fetch all section tracks concurrently with varied query selection
  const sectionPromises = INDIAN_SECTION_DEFS.map(async (def, defIndex) => {
    // Rotate query based on seed and section index
    const queryIndex = (seed + defIndex) % def.queries.length;
    const q = def.queries[queryIndex];
    const raw = await fetchSafeTracks(q);
    return { def, raw };
  });

  const [sectionResults, artists, albums] = await Promise.all([
    Promise.all(sectionPromises),
    fetchSpotlightArtists(),
    fetchSoundtrackAlbums(),
  ]);

  const sections: HomeSection[] = [];
  let allHeroTracks: Track[] = [];

  // 2. Process each section with global deduplication
  for (const { def, raw } of sectionResults) {
    const uniqueTracks: Track[] = [];

    // Prioritize non-duplicate tracks
    for (const t of raw) {
      if (!usedTrackIds.has(t.id)) {
        usedTrackIds.add(t.id);
        uniqueTracks.push(t);
      }
    }

    // In rare cases where unique count is low, fill with remaining items
    if (uniqueTracks.length < 6) {
      for (const t of raw) {
        if (!uniqueTracks.some((u) => u.id === t.id)) {
          uniqueTracks.push(t);
        }
        if (uniqueTracks.length >= 8) break;
      }
    }

    if (uniqueTracks.length > 0) {
      if (def.id === "trending_india") {
        allHeroTracks = uniqueTracks;
      }

      sections.push({
        id: def.id,
        title: def.title,
        subtitle: def.subtitle,
        kicker: def.kicker,
        type: def.type,
        badge: def.badge,
        accent: def.accent,
        moreHref: def.moreHref,
        items: uniqueTracks.slice(0, 16),
      });
    }
  }

  // 3. Inject Artist Spotlight Section if artists are found (around position 14)
  if (artists.length > 0) {
    sections.splice(Math.min(14, sections.length), 0, {
      id: "artist_spotlight",
      title: "🎤 Artist Spotlight",
      subtitle: "Iconic voices of the Indian subcontinent",
      kicker: "Star Voices",
      type: "artists",
      badge: "⭐ Legendary",
      accent: "#f59e0b",
      items: [],
      artists,
    });
  }

  // 4. Inject Iconic Soundtracks Section if albums are found (around position 17)
  if (albums.length > 0) {
    sections.splice(Math.min(17, sections.length), 0, {
      id: "iconic_soundtracks",
      title: "💿 Iconic Soundtracks",
      subtitle: "Timeless Indian album collections",
      kicker: "Cinematic Albums",
      type: "albums",
      badge: "🎬 Blockbusters",
      accent: "#e11d48",
      items: [],
      albums,
    });
  }

  // 5. Inject Languages of India Section (around position 6)
  sections.splice(Math.min(6, sections.length), 0, {
    id: "languages_of_india",
    title: "🌐 Languages of India",
    subtitle: "Explore Hindi, Marathi, Punjabi, Tamil, Telugu, Bengali & more",
    kicker: "Regional Diversity",
    type: "languages",
    badge: "🇮🇳 12+ Languages",
    accent: "#10b981",
    items: [],
  });

  // 6. Dynamic Featured Hero Selection (rotates with seed)
  const heroIndex = seed % Math.max(1, allHeroTracks.length);
  const featuredToday = allHeroTracks[heroIndex] ?? allHeroTracks[0] ?? null;

  const resultData: IndianHomeData = {
    sections,
    hero: allHeroTracks,
    featuredToday,
    generatedAt: Date.now(),
    seed,
  };

  // Cache result
  cache.set(cacheKey, {
    data: resultData,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return resultData;
}
