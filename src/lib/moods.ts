/** Moods, genres and seasonal collections — purely presentational data mapped to catalog queries. */
export type MoodDef = { slug: string; label: string; emoji: string; q: string; from: string; to: string };

export const MOODS: MoodDef[] = [
  { slug: "relax", label: "Relax", emoji: "🧘", q: "relaxing songs", from: "#14b8a6", to: "#134e4a" },
  { slug: "chill", label: "Chill", emoji: "🌙", q: "chill songs", from: "#2563eb", to: "#0f172a" },
  { slug: "commute", label: "Commute", emoji: "🚇", q: "commute playlist songs", from: "#f59e0b", to: "#7c2d12" },
  { slug: "energize", label: "Energize", emoji: "⚡", q: "energetic songs", from: "#ef4444", to: "#7f1d1d" },
  { slug: "feel-good", label: "Feel good", emoji: "😊", q: "feel good songs", from: "#22c55e", to: "#14532d" },
  { slug: "focus", label: "Focus", emoji: "🧠", q: "focus study music", from: "#06b6d4", to: "#164e63" },
  { slug: "gaming", label: "Gaming", emoji: "🎮", q: "gaming music", from: "#8b5cf6", to: "#3b0764" },
  { slug: "party", label: "Party", emoji: "🎉", q: "party hits", from: "#ec4899", to: "#831843" },
  { slug: "romance", label: "Romance", emoji: "💗", q: "romantic songs", from: "#f43f5e", to: "#4c0519" },
  { slug: "sad", label: "Sad", emoji: "🌧️", q: "sad songs", from: "#64748b", to: "#0f172a" },
  { slug: "sleep", label: "Sleep", emoji: "😴", q: "sleep music calm", from: "#4f46e5", to: "#1e1b4b" },
  { slug: "workout", label: "Workout", emoji: "🏋️", q: "workout motivation songs", from: "#f97316", to: "#7c2d12" },
  { slug: "podcasts", label: "Podcasts", emoji: "🎙️", q: "podcast", from: "#a855f7", to: "#3b0764" },
];

export const INDIAN_LANGUAGES: MoodDef[] = [
  { slug: "hindi", label: "Hindi", emoji: "🎤", q: "hindi top songs 2026", from: "#e11d48", to: "#4c0519" },
  { slug: "marathi", label: "Marathi", emoji: "🎶", q: "marathi top hits songs", from: "#059669", to: "#064e3b" },
  { slug: "punjabi", label: "Punjabi", emoji: "🐯", q: "punjabi top hits songs", from: "#d97706", to: "#7c2d12" },
  { slug: "tamil", label: "Tamil", emoji: "🌺", q: "tamil trending hit songs", from: "#0e7490", to: "#083344" },
  { slug: "telugu", label: "Telugu", emoji: "⚡", q: "telugu hit songs", from: "#9333ea", to: "#3b0764" },
  { slug: "bengali", label: "Bengali", emoji: "🪕", q: "bengali popular hit songs", from: "#0284c7", to: "#075985" },
  { slug: "kannada", label: "Kannada", emoji: "🌿", q: "kannada top hit songs", from: "#ea580c", to: "#7c2d12" },
  { slug: "malayalam", label: "Malayalam", emoji: "🌴", q: "malayalam trending songs", from: "#0d9488", to: "#134e4a" },
  { slug: "gujarati", label: "Gujarati", emoji: "💃", q: "gujarati popular songs", from: "#f59e0b", to: "#78350f" },
  { slug: "bhojpuri", label: "Bhojpuri", emoji: "💥", q: "bhojpuri popular hits", from: "#dc2626", to: "#7f1d1d" },
  { slug: "haryanvi", label: "Haryanvi", emoji: "🚜", q: "haryanvi top hits", from: "#65a30d", to: "#365314" },
  { slug: "indie", label: "Indian Indie", emoji: "💎", q: "indian indie songs hindi", from: "#4f46e5", to: "#1e1b4b" },
];

export const GENRES: MoodDef[] = [
  ...INDIAN_LANGUAGES,
  { slug: "african", label: "African", emoji: "🌍", q: "afrobeats hits", from: "#16a34a", to: "#052e16" },
  { slug: "arabic", label: "Arabic", emoji: "🌙", q: "arabic songs hits", from: "#ca8a04", to: "#422006" },
  { slug: "bollywood", label: "Bollywood", emoji: "🎬", q: "bollywood hits", from: "#e11d48", to: "#4c0519" },
  { slug: "classical", label: "Classical", emoji: "🎻", q: "classical music", from: "#78716c", to: "#1c1917" },
  { slug: "country", label: "Country", emoji: "🤠", q: "country hits", from: "#d97706", to: "#451a03" },
  { slug: "dance-electronic", label: "Dance & Electronic", emoji: "🎧", q: "edm dance hits", from: "#7c3aed", to: "#2e1065" },
  { slug: "hip-hop", label: "Hip-Hop", emoji: "🎤", q: "hip hop hits", from: "#dc2626", to: "#450a0a" },
  { slug: "jazz", label: "Jazz", emoji: "🎷", q: "jazz classics", from: "#b45309", to: "#431407" },
  { slug: "k-pop", label: "K-Pop", emoji: "💜", q: "kpop hits", from: "#db2777", to: "#500724" },
  { slug: "latin", label: "Latin", emoji: "💃", q: "latin hits reggaeton", from: "#ea580c", to: "#431407" },
  { slug: "metal", label: "Metal", emoji: "🤘", q: "metal songs", from: "#3f3f46", to: "#09090b" },
  { slug: "pop", label: "Pop", emoji: "✨", q: "pop hits", from: "#f472b6", to: "#831843" },
  { slug: "rnb", label: "R&B & Soul", emoji: "🎹", q: "r&b soul hits", from: "#9333ea", to: "#3b0764" },
  { slug: "reggae", label: "Reggae", emoji: "🌴", q: "reggae classics", from: "#15803d", to: "#052e16" },
  { slug: "rock", label: "Rock", emoji: "🎸", q: "rock hits", from: "#b91c1c", to: "#450a0a" },
  { slug: "lofi", label: "Lo-Fi", emoji: "☕", q: "lofi chill beats", from: "#0d9488", to: "#042f2e" },
];

/** Home-screen editorial playlists (charts, dance, hitlists). */
export const HOME_CURATIONS: MoodDef[] = [
  { slug: "rain-therapy", label: "Rain Therapy", emoji: "🌧️", q: "rain songs hindi lofi", from: "#1d4ed8", to: "#0f172a" },
  { slug: "tamil-chart", label: "Top Weekly Videos Tamil", emoji: "📺", q: "tamil hits", from: "#0e7490", to: "#083344" },
  { slug: "punjabi-chart", label: "Top Weekly Videos Punjabi", emoji: "📺", q: "punjabi hits", from: "#65a30d", to: "#1a2e05" },
  { slug: "telugu-chart", label: "Top Weekly Videos Telugu", emoji: "📺", q: "telugu hits", from: "#c026d3", to: "#4a044e" },
  { slug: "90s-bollywood-dance", label: "90s Bollywood Dance", emoji: "💃", q: "90s bollywood dance", from: "#f59e0b", to: "#9a3412" },
  { slug: "10s-bollywood-dance", label: "10s Bollywood Dance", emoji: "🕺", q: "2010s bollywood dance", from: "#ec4899", to: "#9d174d" },
  { slug: "90s-bollywood-sad", label: "90s Bollywood Sad Songs", emoji: "😢", q: "90s bollywood sad songs", from: "#64748b", to: "#1e293b" },
  { slug: "bollywood-fire", label: "Bollywood Fire", emoji: "🔥", q: "bollywood party hits", from: "#ef4444", to: "#7f1d1d" },
  { slug: "bollywood-recharge", label: "Bollywood Recharge", emoji: "⚡", q: "bollywood workout hits", from: "#f97316", to: "#9a3412" },
  { slug: "punjabi-party", label: "Punjabi Party", emoji: "🎉", q: "punjabi party songs", from: "#22c55e", to: "#14532d" },
  { slug: "bollywood-hitlist", label: "Bollywood Hitlist", emoji: "🇮🇳", q: "bollywood hitlist", from: "#e11d48", to: "#4c0519" },
  { slug: "punjabi-fire", label: "Punjabi Fire", emoji: "🔥", q: "punjabi fire hits", from: "#84cc16", to: "#3f6212" },
  { slug: "tollywood-hitlist", label: "Tollywood Hitlist", emoji: "🎬", q: "tollywood hits", from: "#8b5cf6", to: "#4c1d95" },
];

type Season = { title: string; subtitle: string; items: MoodDef[] };

const SEASONS: Record<"summer" | "autumn" | "winter" | "spring", Season> = {
  summer: {
    title: "Playlists for the Season",
    subtitle: "Hello, Summer! ☀️🍉",
    items: [
      { slug: "summer-hits", label: "Summer Hits", emoji: "☀️", q: "summer hits", from: "#f59e0b", to: "#b91c1c" },
      { slug: "beach-vibes", label: "Beach Vibes", emoji: "🏖️", q: "beach vibes songs", from: "#06b6d4", to: "#1d4ed8" },
      { slug: "road-trip", label: "Road Trip", emoji: "🚗", q: "road trip songs", from: "#22c55e", to: "#0f766e" },
      { slug: "pool-party", label: "Pool Party", emoji: "🍹", q: "pool party dance hits", from: "#ec4899", to: "#7c3aed" },
    ],
  },
  autumn: {
    title: "Playlists for the Season",
    subtitle: "Cozy Autumn 🍂☕",
    items: [
      { slug: "autumn-acoustic", label: "Autumn Acoustic", emoji: "🍂", q: "acoustic autumn songs", from: "#d97706", to: "#7c2d12" },
      { slug: "rainy-day", label: "Rainy Day", emoji: "🌧️", q: "rainy day songs", from: "#475569", to: "#1e293b" },
      { slug: "coffee-shop", label: "Coffee Shop", emoji: "☕", q: "coffee shop jazz", from: "#92400e", to: "#292524" },
      { slug: "late-night-drive", label: "Late Night Drive", emoji: "🌃", q: "late night drive songs", from: "#4338ca", to: "#0f172a" },
    ],
  },
  winter: {
    title: "Playlists for the Season",
    subtitle: "Winter Warmth ❄️🔥",
    items: [
      { slug: "winter-chill", label: "Winter Chill", emoji: "❄️", q: "winter chill songs", from: "#38bdf8", to: "#1e3a8a" },
      { slug: "fireside", label: "Fireside", emoji: "🔥", q: "cozy acoustic songs", from: "#ea580c", to: "#7f1d1d" },
      { slug: "holiday", label: "Holiday Classics", emoji: "🎄", q: "holiday classics", from: "#16a34a", to: "#b91c1c" },
      { slug: "new-year", label: "New Year Party", emoji: "🎆", q: "new year party hits", from: "#a855f7", to: "#db2777" },
    ],
  },
  spring: {
    title: "Playlists for the Season",
    subtitle: "Spring Fresh 🌸🌱",
    items: [
      { slug: "spring-fresh", label: "Spring Fresh", emoji: "🌸", q: "fresh spring songs", from: "#f472b6", to: "#be185d" },
      { slug: "morning-boost", label: "Morning Boost", emoji: "🌅", q: "morning motivation songs", from: "#fbbf24", to: "#ea580c" },
      { slug: "picnic", label: "Picnic Pop", emoji: "🧺", q: "happy pop songs", from: "#4ade80", to: "#15803d" },
      { slug: "bloom", label: "Indie Bloom", emoji: "🌱", q: "indie folk songs", from: "#2dd4bf", to: "#0f766e" },
    ],
  },
};

export function seasonal(date = new Date()): Season {
  const m = date.getMonth();
  if (m >= 5 && m <= 7) return SEASONS.summer;
  if (m >= 8 && m <= 10) return SEASONS.autumn;
  if (m === 11 || m <= 1) return SEASONS.winter;
  return SEASONS.spring;
}

export function findMood(slug: string): MoodDef | undefined {
  return [...MOODS, ...GENRES, ...HOME_CURATIONS, ...Object.values(SEASONS).flatMap((s) => s.items)].find((m) => m.slug === slug);
}
