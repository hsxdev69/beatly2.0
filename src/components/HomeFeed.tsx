"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  History,
  Cast,
  Users,
  Settings,
  Sparkles,
  Play,
  Pause,
  ChevronRight,
  RotateCw,
  Flame,
} from "lucide-react";
import type { Artist, Collection, HomeSection, IndianHomeData, Track } from "@/lib/types";
import { fromSnapshot } from "@/lib/types";
import { INDIAN_LANGUAGES, MOODS } from "@/lib/moods";
import { usePlayer } from "@/store/player";
import { useLocal } from "@/store/local";
import { useLibrary } from "@/store/library";
import { Section, Shelf, TrackCard, FeaturedCard, ArtistCard, CollectionCard, Skeleton } from "@/components/Cards";
import { Artwork } from "@/components/Artwork";
import { cn } from "@/lib/utils";

/** Locked default genre. The feed only ever leaves this when a chip below is explicitly tapped. */
const DEFAULT_GENRE = "romance";

/** A few explicit mood chips (in addition to languages) so "genre chip" really means genre. */
const QUICK_MOOD_SLUGS = ["party", "feel-good", "chill", "sad", "workout"] as const;

type Props = {
  initialData: IndianHomeData;
  /** Genre the server rendered `initialData` for. Always "romance" unless explicitly overridden. */
  initialGenre?: string;
};

export function HomeFeed({ initialData, initialGenre = DEFAULT_GENRE }: Props) {
  const [data, setData] = useState<IndianHomeData>(initialData);
  const [activeGenre, setActiveGenre] = useState<string>(initialGenre);
  const [loadingGenre, setLoadingGenre] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const history = useLocal((s) => s.history);
  const { playQueue, playTrack, openSheet } = usePlayer();
  const notify = useLibrary((s) => s.notify);

  // User's own personalized listening history — only surfaced once the user
  // has explicitly left the strict Romantic default (see rendering below).
  const recentTracks = history.slice(0, 10).map((h) => fromSnapshot(h.track));

  const quickMoods = MOODS.filter((m) => (QUICK_MOOD_SLUGS as readonly string[]).includes(m.slug));

  /**
   * CRITICAL: fetches the feed for a specific, explicit genre/mood/language
   * slug. This is the ONLY way the feed ever changes away from Romantic —
   * it always runs in direct response to an explicit chip tap.
   */
  const fetchGenre = useCallback(
    async (genre: string, opts: { seed?: number; refresh?: boolean; silent?: boolean } = {}) => {
      const seed = opts.seed ?? 0;
      setActiveGenre(genre);
      if (opts.refresh) setRefreshing(true);
      else setLoadingGenre(true);
      try {
        const params = new URLSearchParams({ genre, seed: String(seed) });
        if (opts.refresh) params.set("refresh", "1");
        const res = await fetch(`/api/home?${params}`, { signal: AbortSignal.timeout(15000) });
        if (res.ok) {
          const json = (await res.json()) as { success: boolean; data?: IndianHomeData };
          if (json.success && json.data && json.data.sections.length > 0) {
            setData(json.data);
            if (!opts.silent) {
              notify(
                genre === DEFAULT_GENRE
                  ? "Romantic songs 💕"
                  : genre === "all"
                    ? "Showing All India mix"
                    : `Showing ${genre} picks`,
              );
            }
          }
        }
      } catch {
        notify("Couldn't load that category — staying on the current feed");
      } finally {
        setRefreshing(false);
        setLoadingGenre(false);
      }
    },
    [notify],
  );

  const handleChipClick = (slug: string) => {
    if (slug === activeGenre) return; // already showing this — locked/no-op
    fetchGenre(slug, { seed: 0 });
  };

  // Pull-to-refresh: re-rolls the seed WITHIN the currently active genre.
  // If no chip was ever clicked, activeGenre is still "romance", so refresh
  // strictly stays within Romantic content — it never jumps to a mixed feed.
  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    const nextSeed = (data.seed ?? 0) + 1;
    fetchGenre(activeGenre, { seed: nextSeed, refresh: true, silent: true });
    notify(activeGenre === DEFAULT_GENRE ? "Refreshed romantic picks ✨" : "Refreshed ✨");
  }, [activeGenre, data.seed, fetchGenre, notify, refreshing]);

  // The server always returns the "hero" section first — for the default
  // Romantic feed that's "Romantic Hits"; for an explicit chip it's
  // "{Genre} Hits"; for the explicit "All India" chip it's "Trending in India".
  const heroSection = data.sections[0];
  const heroTracks = data.hero.length > 0 ? data.hero : heroSection?.items ?? [];
  const restSections = data.sections.slice(1);
  const isDefaultRomantic = activeGenre === DEFAULT_GENRE;

  return (
    <div className="pb-8">
      {/* 2.1 Top App Bar */}
      <header className="sticky top-0 z-20 bg-gradient-to-b from-black via-black/95 to-transparent px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))] md:px-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-white shadow-lg shadow-brand/30 md:hidden">
              <Sparkles size={16} />
            </span>
            <span className="text-[1.35rem] font-black tracking-tight">Beatly</span>
            <span className="hidden items-center gap-1 rounded-full bg-brand/15 px-2.5 py-0.5 text-[10px] font-bold text-brand sm:inline-flex">
              🇮🇳 INDIA DISCOVERY
            </span>
          </Link>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-50"
              aria-label="Refresh Discovery"
              title="Refresh Discovery with new songs"
            >
              <RotateCw size={19} className={cn("transition-transform", refreshing && "animate-spin text-brand")} />
            </button>
            <Icon href="/history" icon={History} label="History" />
            <button
              onClick={() => openSheet("audio")}
              className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Cast / audio output"
            >
              <Cast size={20} />
            </button>
            <Icon href="/stats" icon={Users} label="Community stats" />
            <Icon href="/settings" icon={Settings} label="Settings" />
          </div>
        </div>

        {/* 2.2 Quick Filter Chips: Romantic is the default/locked chip.
             The feed ONLY ever leaves Romantic when one of these is tapped. */}
        <div className="no-scrollbar -mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
          <button
            onClick={() => handleChipClick(DEFAULT_GENRE)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition",
              isDefaultRomantic ? "bg-brand text-white shadow-md shadow-brand/30" : "glass text-white/80 hover:bg-white/15",
            )}
          >
            💕 Romantic
          </button>
          <button
            onClick={() => handleChipClick("all")}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition",
              activeGenre === "all" ? "bg-white text-black shadow-md" : "glass text-white/80 hover:bg-white/15",
            )}
          >
            🇮🇳 All India
          </button>
          {quickMoods.map((mood) => (
            <button
              key={mood.slug}
              onClick={() => handleChipClick(mood.slug)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition",
                activeGenre === mood.slug ? "bg-brand text-white shadow-md shadow-brand/30" : "glass text-white/80 hover:bg-white/15",
              )}
            >
              {mood.emoji} {mood.label}
            </button>
          ))}
          {INDIAN_LANGUAGES.map((lang) => (
            <button
              key={lang.slug}
              onClick={() => handleChipClick(lang.slug)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition",
                activeGenre === lang.slug ? "bg-brand text-white shadow-md shadow-brand/30" : "glass text-white/80 hover:bg-white/15",
              )}
            >
              {lang.emoji} {lang.label}
            </button>
          ))}
        </div>
      </header>

      {/* Loading state skeleton while an explicit chip's feed is loading */}
      {(refreshing || loadingGenre) && (
        <div className="mx-4 mb-4 flex items-center justify-center gap-2 rounded-2xl bg-brand/10 py-2.5 text-xs font-bold text-brand md:mx-6">
          <RotateCw size={14} className="animate-spin" />
          {isDefaultRomantic ? "Finding fresh romantic songs…" : "Loading picks…"}
        </div>
      )}

      {/* Empty fallback if no data loaded yet */}
      {data.sections.length === 0 && !refreshing && !loadingGenre && (
        <div className="mx-4 mb-6 space-y-4 rounded-3xl bg-white/5 p-6 md:mx-6">
          <p className="font-bold">Loading Romantic Songs...</p>
          <div className="space-y-3">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      )}

      {/* Hero section — always the first section returned by the server:
          "Romantic Hits" by default, or "{Genre} Hits" / "Trending in India"
          only when the user explicitly picked a different chip. */}
      {heroTracks.length > 0 && (
        <div className="pt-4">
          <Section
            kicker={heroSection?.kicker ?? "💕 Top Picks"}
            title={heroSection?.title ?? "Romantic Hits"}
            subtitle={heroSection?.subtitle}
            href={heroSection?.moreHref}
            action={
              <button
                onClick={() => playQueue(heroTracks)}
                className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-black transition hover:scale-105 active:scale-95"
              >
                Play all
              </button>
            }
          >
            <Shelf className="snap-x pb-2">
              {heroTracks.slice(0, 10).map((t) => (
                <FeaturedCard key={`hero-${t.id}`} track={t} context={heroTracks} />
              ))}
            </Shelf>
          </Section>
        </div>
      )}

      {/* Personalized Section: Jump Back In — only shown once the user has
          explicitly left the strict Romantic default, so the default view
          never mixes in the user's (potentially non-romantic) history. */}
      {recentTracks.length > 0 && !isDefaultRomantic && (
        <Section
          kicker="Personalized for You"
          title="❤️ Jump Back In"
          subtitle="Your recent listening history"
          href="/history"
          action={
            <Link href="/history" className="text-xs font-bold text-muted hover:text-white">
              See all
            </Link>
          }
        >
          <div className="grid grid-cols-1 gap-2 px-4 sm:grid-cols-2 md:px-6">
            {recentTracks.slice(0, 6).map((t) => (
              <SpeedDialItem key={`recent-${t.id}`} track={t} context={recentTracks} />
            ))}
          </div>
        </Section>
      )}

      {/* Remaining sections for whichever genre is currently active
          (Romantic sub-sections by default, or the selected chip's sections). */}
      {restSections.map((section) => (
        <DynamicSectionRenderer
          key={section.id}
          section={section}
          onPlayTrack={playTrack}
          onPlayQueue={playQueue}
        />
      ))}
    </div>
  );
}

/**
 * Reusable dynamic section renderer:
 * Supports 'featured', 'speed_dial', 'songs', 'songs_large', 'banners', 'artists', 'albums', 'languages'.
 */
function DynamicSectionRenderer({
  section,
  onPlayTrack,
  onPlayQueue,
}: {
  section: HomeSection;
  onPlayTrack: (track: Track, context?: Track[]) => void;
  onPlayQueue: (tracks: Track[], startIndex?: number) => void;
}) {
  const { type, items, artists, albums, title, subtitle, kicker, moreHref } = section;

  // 1. Speed Dial: 2-column compact grid
  if (type === "speed_dial" && items.length > 0) {
    return (
      <Section
        kicker={kicker}
        title={title}
        subtitle={subtitle}
        href={moreHref}
        action={
          items.length > 0 && (
            <button
              onClick={() => onPlayQueue(items)}
              className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-black transition hover:scale-105 active:scale-95"
            >
              Play all
            </button>
          )
        }
      >
        <div className="grid grid-cols-1 gap-2 px-4 sm:grid-cols-2 md:px-6">
          {items.slice(0, 8).map((t) => (
            <SpeedDialItem key={`${section.id}-${t.id}`} track={t} context={items} />
          ))}
        </div>
      </Section>
    );
  }

  // 2. Large song cards (e.g. Hindi Hits, South Indian Superhits)
  if (type === "songs_large" && items.length > 0) {
    return (
      <Section
        kicker={kicker}
        title={title}
        subtitle={subtitle}
        href={moreHref}
        action={
          items.length > 0 && (
            <button
              onClick={() => onPlayQueue(items)}
              className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-black transition hover:scale-105 active:scale-95"
            >
              Play all
            </button>
          )
        }
      >
        <Shelf>
          {items.map((t) => (
            <TrackCard key={`${section.id}-${t.id}`} track={t} context={items} size="lg" />
          ))}
        </Shelf>
      </Section>
    );
  }

  // 3. High-energy banners (e.g. Bollywood Party)
  if (type === "banners" && items.length > 0) {
    return (
      <Section kicker={kicker} title={title} subtitle={subtitle} href={moreHref}>
        <div className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 lg:grid-cols-3 md:px-6">
          {items.slice(0, 6).map((t, idx) => (
            <PartyBannerCard key={`${section.id}-${t.id}`} track={t} context={items} index={idx} />
          ))}
        </div>
      </Section>
    );
  }

  // 4. Artist Spotlight (Circular artist cards)
  if (type === "artists" && artists && artists.length > 0) {
    return (
      <Section kicker={kicker} title={title} subtitle={subtitle}>
        <Shelf>
          {artists.map((a) => (
            <ArtistCard key={`${section.id}-${a.id}`} artist={a} />
          ))}
        </Shelf>
      </Section>
    );
  }

  // 5. Iconic Soundtracks (Albums)
  if (type === "albums" && albums && albums.length > 0) {
    return (
      <Section kicker={kicker} title={title} subtitle={subtitle}>
        <Shelf>
          {albums.map((al) => (
            <CollectionCard key={`${section.id}-${al.id}`} collection={al} />
          ))}
        </Shelf>
      </Section>
    );
  }

  // 6. Languages of India Explorer
  if (type === "languages") {
    return (
      <Section kicker={kicker} title={title} subtitle={subtitle}>
        <div className="grid grid-cols-2 gap-2.5 px-4 sm:grid-cols-3 md:grid-cols-4 md:px-6">
          {INDIAN_LANGUAGES.map((lang) => (
            <Link
              key={`grid-${lang.slug}`}
              href={`/mood/${lang.slug}`}
              className="relative flex h-24 overflow-hidden rounded-2xl p-3.5 font-black shadow-lg transition hover:scale-[1.02]"
              style={{ background: `linear-gradient(135deg, ${lang.from}, ${lang.to})` }}
            >
              <span className="absolute right-2 top-2 text-3xl opacity-75 drop-shadow">
                {lang.emoji}
              </span>
              <div className="self-end">
                <span className="block text-base leading-tight drop-shadow">{lang.label}</span>
                <span className="text-[10px] font-semibold text-white/70">Top Charts</span>
              </div>
            </Link>
          ))}
        </div>
      </Section>
    );
  }

  // 7. Standard song shelf (Default for all other song categories)
  if (items.length > 0) {
    return (
      <Section
        kicker={kicker}
        title={title}
        subtitle={subtitle}
        href={moreHref}
        action={
          items.length > 0 && (
            <button
              onClick={() => onPlayQueue(items)}
              className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-black transition hover:scale-105 active:scale-95"
            >
              Play all
            </button>
          )
        }
      >
        <Shelf>
          {items.map((t) => (
            <TrackCard key={`${section.id}-${t.id}`} track={t} context={items} />
          ))}
        </Shelf>
      </Section>
    );
  }

  return null;
}

/** Compact 2-column Speed Dial card */
function SpeedDialItem({ track, context }: { track: Track; context: Track[] }) {
  const active = usePlayer((s) => s.queue[s.index]?.id === track.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const { playTrack, toggle } = usePlayer();

  return (
    <button
      onClick={() => (active ? toggle() : playTrack(track, context))}
      className="group flex items-center gap-3 rounded-2xl bg-white/5 p-2 pr-3 text-left transition hover:bg-white/10 active:scale-[0.99]"
    >
      <span className="relative shrink-0">
        <Artwork src={track.artwork} alt={track.title} className="h-14 w-14 rounded-xl shadow-md" />
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-xl bg-black/45 transition",
            active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          {active && isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" className="ml-0.5" />}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-bold", active && "text-brand")}>
          {track.title}
        </span>
        <span className="block truncate text-xs text-muted">{track.artist}</span>
      </span>
    </button>
  );
}

/** Party Banner Card with energetic backdrop gradient */
function PartyBannerCard({
  track,
  context,
  index,
}: {
  track: Track;
  context: Track[];
  index: number;
}) {
  const active = usePlayer((s) => s.queue[s.index]?.id === track.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const { playTrack, toggle } = usePlayer();

  const gradients = [
    "from-amber-600/70 to-red-900/90",
    "from-pink-600/70 to-purple-900/90",
    "from-rose-600/70 to-orange-900/90",
    "from-violet-600/70 to-fuchsia-900/90",
    "from-emerald-600/70 to-teal-900/90",
    "from-blue-600/70 to-indigo-900/90",
  ];
  const bg = gradients[index % gradients.length];

  return (
    <button
      onClick={() => (active ? toggle() : playTrack(track, context))}
      className={cn(
        "group relative flex h-28 overflow-hidden rounded-2xl bg-gradient-to-r p-3.5 text-left shadow-lg transition hover:scale-[1.01] active:scale-[0.99]",
        bg,
      )}
    >
      {track.artwork && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.artwork}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-20 blur-sm transition duration-500 group-hover:scale-105"
        />
      )}
      <div className="relative flex w-full items-center gap-3">
        <Artwork src={track.artwork} alt={track.title} className="h-20 w-20 shrink-0 rounded-xl shadow-2xl" />
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-white/80">
            <Flame size={12} className="text-amber-400" /> Sangeet & Club
          </span>
          <p className="line-clamp-1 text-base font-black leading-tight drop-shadow">{track.title}</p>
          <p className="line-clamp-1 text-xs text-white/70">{track.artist}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-xl transition group-hover:scale-105">
          {active && isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </span>
      </div>
    </button>
  );
}

function Icon({ href, icon: I, label }: { href: string; icon: typeof History; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
      aria-label={label}
    >
      <I size={20} />
    </Link>
  );
}
