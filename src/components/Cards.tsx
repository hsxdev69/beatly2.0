"use client";

import Link from "next/link";
import { Play, Pause, ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePlayer } from "@/store/player";
import type { Artist, Collection, Track } from "@/lib/types";
import type { MoodDef } from "@/lib/moods";
import { Artwork } from "@/components/Artwork";
import { cn } from "@/lib/utils";

export function Section({
  title,
  subtitle,
  kicker,
  children,
  action,
  href,
}: {
  title: string;
  subtitle?: string;
  kicker?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  href?: string;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3 px-4 md:px-6">
        <div className="min-w-0">
          {kicker && (
            <p className="mb-0.5 truncate text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">{kicker}</p>
          )}
          {href ? (
            <Link href={href} className="block truncate text-lg font-extrabold hover:underline md:text-xl">
              {title}
            </Link>
          ) : (
            <h2 className="truncate text-lg font-extrabold md:text-xl">{title}</h2>
          )}
          {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Shelf({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:px-6", className)}>{children}</div>;
}

export function TrackCard({ track, context, size = "md" }: { track: Track; context: Track[]; size?: "md" | "lg" }) {
  const active = usePlayer((s) => s.queue[s.index]?.id === track.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const { playTrack, toggle } = usePlayer();
  return (
    <div className={cn("group relative shrink-0 snap-start", size === "lg" ? "w-40 md:w-44" : "w-32 md:w-36")}>
      <button onClick={() => (active ? toggle() : playTrack(track, context))} className="relative block w-full text-left">
        <Artwork src={track.artwork} alt={track.title} iconSize={40} className="aspect-square w-full rounded-2xl shadow-lg" />
        <span
          className={cn(
            "absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-xl transition",
            active ? "opacity-100" : "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100",
          )}
        >
          {active && isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </span>
      </button>
      <button onClick={() => (active ? toggle() : playTrack(track, context))} className="w-full text-left">
        <p className={cn("mt-2 truncate text-sm font-semibold hover:underline", active && "text-brand")}>{track.title}</p>
      </button>
      <Link href={track.artistId ? `/artist/${track.artistId}` : "#"} className="block truncate text-xs text-muted hover:underline">{track.artist}</Link>
    </div>
  );
}

export function FeaturedCard({ track, context }: { track: Track; context: Track[] }) {
  const active = usePlayer((s) => s.queue[s.index]?.id === track.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const { playTrack, toggle } = usePlayer();
  return (
    <button
      onClick={() => (active ? toggle() : playTrack(track, context))}
      className="group relative aspect-[3/4] w-[70vw] max-w-[280px] shrink-0 snap-center overflow-hidden rounded-[28px] text-left shadow-2xl md:w-[260px]"
    >
      <Artwork src={track.artwork} alt={track.title} iconSize={64} className="absolute inset-0 h-full w-full transition duration-500 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5">
        <p className="line-clamp-3 text-[1.65rem] font-black leading-[1.05] tracking-tight drop-shadow-lg">{track.title}</p>
        <p className="mt-2 truncate text-sm font-medium text-white/75">{track.artist}{track.album ? ` · ${track.album}` : ""}</p>
      </div>
      <span className={cn("absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-xl transition", active ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
        {active && isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
      </span>
    </button>
  );
}

export function MoodCard({ mood, compact }: { mood: MoodDef; compact?: boolean }) {
  return (
    <Link
      href={`/mood/${mood.slug}`}
      className={cn("relative flex overflow-hidden rounded-2xl p-4 font-extrabold shadow-lg transition hover:scale-[1.02]", compact ? "h-20 items-end text-base" : "h-28 items-end text-lg")}
      style={{ background: `linear-gradient(135deg, ${mood.from}, ${mood.to})` }}
    >
      <span className="absolute right-3 top-2 text-3xl opacity-80 drop-shadow">{mood.emoji}</span>
      {mood.label}
    </Link>
  );
}

export function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link href={`/artist/${artist.id}`} className="w-32 shrink-0 snap-start text-center md:w-36">
      <Artwork src={artist.avatar} alt={artist.name} iconSize={40} className="aspect-square w-full rounded-full shadow-lg" />
      <p className="mt-2 truncate text-sm font-semibold">{artist.name}</p>
      <p className="truncate text-xs text-muted">Artist</p>
    </Link>
  );
}

export function CollectionCard({ collection }: { collection: Collection }) {
  return (
    <Link href={`/collection/${collection.id}`} className="w-32 shrink-0 snap-start md:w-36">
      <Artwork src={collection.artwork} alt={collection.name} iconSize={40} className="aspect-square w-full rounded-2xl shadow-lg" />
      <p className="mt-2 truncate text-sm font-semibold">{collection.name}</p>
      <p className="truncate text-xs text-muted">
        {collection.isAlbum ? (collection.year ? `${collection.year} · Album` : "Album") : "Playlist"} · {collection.artist}
      </p>
    </Link>
  );
}

export function PlayAllButton({ tracks, className, shuffle }: { tracks: Track[]; className?: string; shuffle?: boolean }) {
  const { playQueue } = usePlayer();
  if (!tracks.length) return null;
  return (
    <button
      onClick={() => playQueue(shuffle ? [...tracks].sort(() => Math.random() - 0.5) : tracks, 0)}
      className={cn("flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-xl shadow-brand/40 transition hover:scale-105 active:scale-95", className)}
      aria-label="Play all"
    >
      <Play size={26} fill="currentColor" className="ml-1" />
    </button>
  );
}

export function PageHeader({ title, subtitle, right, back = true }: { title: string; subtitle?: string; right?: React.ReactNode; back?: boolean }) {
  const router = useRouter();
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 bg-gradient-to-b from-black via-black/90 to-transparent px-3 pb-4 pt-[calc(0.75rem+env(safe-area-inset-top))] md:px-5">
      {back && (
        <button onClick={() => router.back()} className="rounded-full p-2 hover:bg-white/10" aria-label="Back">
          <ChevronLeft size={24} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-extrabold md:text-2xl">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-white/10", className)} />;
}
