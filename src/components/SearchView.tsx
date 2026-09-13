"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, X, Mic, Globe, Clock, ArrowUpLeft, Play } from "lucide-react";
import type { Artist, Collection, Track } from "@/lib/types";
import { fromSnapshot } from "@/lib/types";
import { MOODS, GENRES } from "@/lib/moods";
import { usePlayer } from "@/store/player";
import { useLocal } from "@/store/local";
import { useLibrary } from "@/store/library";
import { TrackList } from "@/components/TrackList";
import { ArtistCard, CollectionCard, MoodCard, Section, Shelf, Skeleton } from "@/components/Cards";
import { Artwork } from "@/components/Artwork";
import { cn } from "@/lib/utils";

type Result = { tracks: Track[]; artists: Artist[]; collections: Collection[] };
type Tab = "explore" | "suggestions" | "albums";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
function getSpeech(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function SearchView() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [tab, setTab] = useState<Tab>("explore");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { recentSearches, addSearch, history } = useLocal();
  const openSheet = usePlayer((s) => s.openSheet);
  const playTrack = usePlayer((s) => s.playTrack);
  const notify = useLibrary((s) => s.notify);
  const speechSupported = !!getSpeech();

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      abortRef.current?.abort();
      setResult(null);
      setLoading(false);
      window.history.replaceState(null, "", "/search");
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        const data = (await res.json()) as Result;
        if (abortRef.current !== ctrl) return;
        setResult(data);
        setLoading(false);
        addSearch(query);
        window.history.replaceState(null, "", `/search?q=${encodeURIComponent(query)}`);
      } catch {
        /* superseded */
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const voice = () => {
    const SR = getSpeech();
    if (!SR) return notify("Voice search isn't supported in this browser");
    const rec = new SR();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => setQ(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      notify("Couldn't hear you — try again");
    };
    setListening(true);
    rec.start();
  };

  const recent = history.slice(0, 8).map((h) => fromSnapshot(h.track));
  const searching = q.trim().length > 0;

  return (
    <div className="pb-6">
      <div className="sticky top-0 z-20 bg-gradient-to-b from-black via-black/95 to-transparent px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:px-6">
        <div className="glass relative flex items-center rounded-full">
          <Search size={20} className="pointer-events-none absolute left-4 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Songs, artists, albums…"
            className="w-full bg-transparent py-3 pl-12 pr-24 text-sm outline-none placeholder:text-muted"
            aria-label="Search"
          />
          <div className="absolute right-2 flex items-center gap-0.5">
            {q ? (
              <button onClick={() => setQ("")} className="rounded-full p-2 text-muted hover:text-white" aria-label="Clear"><X size={18} /></button>
            ) : (
              speechSupported && (
                <button onClick={voice} className={cn("rounded-full p-2", listening ? "animate-pulse text-brand" : "text-muted hover:text-white")} aria-label="Voice search"><Mic size={18} /></button>
              )
            )}
            <button onClick={() => openSheet("region")} className="rounded-full p-2 text-muted hover:text-white" aria-label="Regional music"><Globe size={18} /></button>
          </div>
        </div>
        {!searching && (
          <div className="mt-3 flex gap-1 rounded-full bg-white/5 p-1">
            {(["explore", "suggestions", "albums"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn("flex-1 rounded-full py-1.5 text-sm font-semibold capitalize transition", tab === t ? "bg-white text-black" : "text-muted hover:text-white")}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {searching && loading && !result && (
        <div className="space-y-2 px-4 md:px-6">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      )}
      {searching && result && (
        <div className={cn("transition", loading && "opacity-60")}>
          {!result.tracks.length && !result.artists.length && !result.collections.length && (
            <p className="px-4 text-muted md:px-6">No results for &ldquo;{q}&rdquo;.</p>
          )}
          {result.tracks.length > 0 && (
            <Section title="Songs">
              <div className="px-2 md:px-4"><TrackList tracks={result.tracks} numbered={false} /></div>
            </Section>
          )}
          {result.artists.length > 0 && (
            <Section title="Artists"><Shelf>{result.artists.map((a) => <ArtistCard key={a.id} artist={a} />)}</Shelf></Section>
          )}
          {result.collections.length > 0 && (
            <Section title="Albums & playlists"><Shelf>{result.collections.map((c) => <CollectionCard key={c.id} collection={c} />)}</Shelf></Section>
          )}
        </div>
      )}

      {/* Explore */}
      {!searching && tab === "explore" && (
        <>
          <Section title="Moods & moments">
            <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-4 md:px-6">
              {MOODS.filter((m) => m.slug !== "podcasts").map((m) => <MoodCard key={m.slug} mood={m} compact />)}
            </div>
          </Section>
          <Section title="Genres">
            <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-4 md:px-6">
              {GENRES.map((g) => <MoodCard key={g.slug} mood={g} compact />)}
            </div>
          </Section>
        </>
      )}

      {/* Suggestions */}
      {!searching && tab === "suggestions" && (
        <>
          {recentSearches.length > 0 && (
            <Section title="Recent searches">
              <div className="px-4 md:px-6">
                {recentSearches.map((s) => (
                  <button key={s} onClick={() => setQ(s)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-white/5">
                    <Clock size={16} className="text-muted" />
                    <span className="flex-1 truncate text-sm">{s}</span>
                    <ArrowUpLeft size={16} className="text-muted" />
                  </button>
                ))}
              </div>
            </Section>
          )}
          {recent.length > 0 && (
            <Section title="Play it again" subtitle="From your listening history">
              <div className="px-2 md:px-4">
                {recent.map((t) => (
                  <button key={t.id} onClick={() => playTrack(t, recent)} className="group flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-white/5">
                    <Artwork src={t.artwork} alt="" className="h-12 w-12 rounded-xl" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{t.title}</span>
                      <span className="block truncate text-xs text-muted">{t.artist}</span>
                    </span>
                    <Play size={16} className="text-muted group-hover:text-white" />
                  </button>
                ))}
              </div>
            </Section>
          )}
          <Section title="Try searching for">
            <div className="flex flex-wrap gap-2 px-4 md:px-6">
              {["Top hits 2026", "Acoustic covers", "90s R&B", "Movie soundtracks", "Piano relax", "Afrobeats", "Indie pop", "Workout mix"].map((s) => (
                <button key={s} onClick={() => setQ(s)} className="glass rounded-full px-4 py-1.5 text-sm font-semibold hover:bg-white/15">{s}</button>
              ))}
            </div>
          </Section>
        </>
      )}

      {/* Albums */}
      {!searching && tab === "albums" && <AlbumsTab onSearch={setQ} />}
    </div>
  );
}

function AlbumsTab({ onSearch }: { onSearch: (q: string) => void }) {
  const history = useLocal((s) => s.history);
  const albums = new Map<string, { id: string; name: string; artist: string; artwork: string | null }>();
  for (const h of history) if (h.track.albumId && h.track.album && !albums.has(h.track.albumId)) albums.set(h.track.albumId, { id: h.track.albumId, name: h.track.album, artist: h.track.artist, artwork: h.track.artwork });
  const list = [...albums.values()];
  return (
    <>
      {list.length > 0 && (
        <Section title="Albums you've played">
          <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-4 md:px-6">
            {list.map((a) => (
              <Link key={a.id} href={`/collection/${a.id}`} className="group">
                <Artwork src={a.artwork} alt={a.name} iconSize={40} className="aspect-square w-full rounded-2xl shadow-lg" />
                <p className="mt-2 truncate text-sm font-semibold">{a.name}</p>
                <p className="truncate text-xs text-muted">{a.artist}</p>
              </Link>
            ))}
          </div>
        </Section>
      )}
      <Section title="Discover albums">
        <div className="flex flex-wrap gap-2 px-4 md:px-6">
          {["Best albums 2026", "Classic rock albums", "Hip hop albums", "Jazz albums", "K-pop albums", "Bollywood albums", "Indie albums", "Soundtrack albums"].map((s) => (
            <button key={s} onClick={() => onSearch(s)} className="glass rounded-full px-4 py-1.5 text-sm font-semibold hover:bg-white/15">{s}</button>
          ))}
        </div>
      </Section>
    </>
  );
}
