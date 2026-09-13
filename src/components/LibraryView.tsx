"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownUp, ChevronDown, Plus, FolderOpen, Sparkles, LogOut, LogIn, ListMusic } from "lucide-react";
import type { TrackSnapshot } from "@/db/schema";
import { fromSnapshot, type Track } from "@/lib/types";
import { useLibrary } from "@/store/library";
import { useLocal } from "@/store/local";
import { TrackList } from "@/components/TrackList";
import { Artwork } from "@/components/Artwork";
import { Sheet } from "@/components/Sheet";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type Tab = "playlists" | "songs" | "albums" | "artists" | "local";
type SortKey = "added" | "title" | "artist";

const FOLDERS = [
  { key: "liked", href: "/liked", emoji: "❤️", label: "Liked", grad: "from-rose-500 to-pink-600" },
  { key: "downloaded", href: "/folder/downloaded", emoji: "📥", label: "Downloaded", grad: "from-emerald-500 to-teal-600" },
  { key: "cached", href: "/folder/cached", emoji: "🔄", label: "Cached", grad: "from-sky-500 to-indigo-600" },
  { key: "uploaded", href: "/folder/uploaded", emoji: "☁️", label: "Uploaded", grad: "from-slate-500 to-slate-700" },
  { key: "top", href: "/folder/top", emoji: "📈", label: "My top 50", grad: "from-amber-500 to-orange-600" },
  { key: "local", href: "/folder/local", emoji: "📁", label: "Local", grad: "from-violet-500 to-purple-700" },
] as const;

export function LibraryView() {
  const router = useRouter();
  const { user, loaded, playlists, likedIds, notify, setUser } = useLibrary();
  const { downloads, history, local, counts, importLocal } = useLocal();
  const [tab, setTab] = useState<Tab>("playlists");
  const [sort, setSort] = useState<SortKey>("added");
  const [desc, setDesc] = useState(true);
  const [sortOpen, setSortOpen] = useState(false);
  const [liked, setLiked] = useState<Track[]>([]);

  useEffect(() => {
    if (!user) return setLiked([]);
    fetch("/api/likes").then((r) => r.json()).then((j) => setLiked((j.tracks as TrackSnapshot[]).map(fromSnapshot))).catch(() => {});
  }, [user, likedIds.size]);

  const sorter = (a: { track: Track; at: number }, b: { track: Track; at: number }) => {
    const r = sort === "added" ? a.at - b.at : sort === "title" ? a.track.title.localeCompare(b.track.title) : a.track.artist.localeCompare(b.track.artist);
    return desc ? -r : r;
  };

  const songs = useMemo(() => liked.map((t, i) => ({ track: t, at: liked.length - i })).sort(sorter).map((x) => x.track), [liked, sort, desc]); // eslint-disable-line react-hooks/exhaustive-deps
  const localTracks = useMemo(() => Object.values(local).map((l) => ({ track: fromSnapshot(l.track), at: l.at })).sort(sorter).map((x) => x.track), [local, sort, desc]); // eslint-disable-line react-hooks/exhaustive-deps

  const albums = useMemo(() => {
    const map = new Map<string, { id: string; name: string; artist: string; artwork: string | null; at: number; n: number }>();
    const src = [...liked.map((t, i) => ({ t, at: Date.now() - i })), ...history.map((h) => ({ t: h.track, at: h.at }))];
    for (const { t, at } of src) {
      if (!t.albumId || !t.album) continue;
      const e = map.get(t.albumId);
      if (e) e.n++;
      else map.set(t.albumId, { id: t.albumId, name: t.album, artist: t.artist, artwork: t.artwork, at, n: 1 });
    }
    return [...map.values()].sort((a, b) => (desc ? b.at - a.at : a.at - b.at));
  }, [liked, history, desc]);

  const artists = useMemo(() => {
    const map = new Map<string, { id: string; name: string; artwork: string | null; n: number; at: number }>();
    const src = [...liked.map((t) => ({ t, at: Date.now() })), ...Object.values(counts).map((c) => ({ t: c.track, at: c.last }))];
    for (const { t, at } of src) {
      if (!t.artistId) continue;
      const e = map.get(t.artistId);
      if (e) e.n++;
      else map.set(t.artistId, { id: t.artistId, name: t.artist, artwork: t.artwork, n: 1, at });
    }
    return [...map.values()].sort((a, b) => (desc ? b.n - a.n : a.n - b.n));
  }, [liked, counts, desc]);

  const counts_: Record<string, number> = {
    liked: likedIds.size,
    downloaded: Object.keys(downloads).length,
    cached: history.length,
    uploaded: 0,
    top: Math.min(50, Object.keys(counts).length),
    local: Object.keys(local).length,
  };

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    useLibrary.setState({ likedIds: new Set(), playlists: [] });
    notify("Signed out");
    router.refresh();
  }

  return (
    <div className="pb-6">
      <div className="sticky top-0 z-20 bg-gradient-to-b from-black via-black/95 to-transparent px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">Library</h1>
          <div className="flex items-center gap-1">
            {user ? (
              <>
                <span className="glass hidden items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-semibold sm:flex">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold">{user.name.charAt(0).toUpperCase()}</span>
                  {user.name}
                </span>
                <button onClick={logout} className="rounded-full p-2 text-white/80 hover:bg-white/10" aria-label="Sign out"><LogOut size={20} /></button>
              </>
            ) : (
              <Link href="/login" className="flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-bold text-black"><LogIn size={16} /> Log in</Link>
            )}
            <button onClick={() => window.dispatchEvent(new CustomEvent("beatly:create-playlist"))} className="rounded-full p-2 text-white/80 hover:bg-white/10" aria-label="New playlist"><Plus size={22} /></button>
          </div>
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:-mx-6 md:px-6">
          {(["playlists", "songs", "albums", "artists", "local"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition", tab === t ? "bg-white text-black" : "glass hover:bg-white/15")}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Sort control */}
      <div className="mb-2 flex items-center justify-between px-4 md:px-6">
        <button onClick={() => setSortOpen(true)} className="flex items-center gap-1 text-sm font-semibold text-white/80">
          {sort === "added" ? "Date added" : sort === "title" ? "Title" : "Artist"} <ChevronDown size={16} />
        </button>
        <button onClick={() => setDesc((d) => !d)} className="rounded-full p-2 text-white/80 hover:bg-white/10" aria-label="Toggle sort direction">
          <ArrowDownUp size={18} className={cn("transition", !desc && "rotate-180")} />
        </button>
      </div>
      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title="Sort by">
        {(["added", "title", "artist"] as SortKey[]).map((k) => (
          <button key={k} onClick={() => { setSort(k); setSortOpen(false); }} className={cn("flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-semibold hover:bg-white/5", sort === k && "text-brand")}>
            {k === "added" ? "Date added" : k === "title" ? "Title" : "Artist"}
          </button>
        ))}
      </Sheet>

      {tab === "playlists" && (
        <div className="px-4 md:px-6">
          <div className="space-y-1">
            {FOLDERS.map((f) => (
              <Link key={f.key} href={f.href} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-white/5">
                <span className={cn("flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br text-2xl shadow-lg", f.grad)}>{f.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{f.label}</span>
                  <span className="block text-xs text-muted">{counts_[f.key]} {counts_[f.key] === 1 ? "song" : "songs"}</span>
                </span>
              </Link>
            ))}
          </div>
          <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-muted">Your playlists</p>
          {!loaded && <p className="text-sm text-muted">Loading…</p>}
          {loaded && !user && (
            <div className="glass rounded-2xl p-4">
              <p className="font-bold">Sign in to sync playlists</p>
              <p className="text-sm text-muted">Your playlists and likes are saved to your account.</p>
              <Link href="/login" className="mt-3 inline-block rounded-full bg-white px-4 py-1.5 text-sm font-bold text-black">Log in</Link>
            </div>
          )}
          {user && playlists.length === 0 && (
            <button onClick={() => window.dispatchEvent(new CustomEvent("beatly:create-playlist"))} className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10"><Plus size={20} /></span>
              <span><span className="block font-semibold">Create your first playlist</span><span className="text-xs text-muted">It&apos;s easy — we&apos;ll help you</span></span>
            </button>
          )}
          <div className="space-y-1">
            {playlists.map((p) => (
              <Link key={p.id} href={`/playlist/${p.id}`} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-white/5">
                {p.artwork ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.artwork} alt="" className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-muted"><ListMusic size={22} /></span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block text-xs text-muted">Playlist · {p.trackCount} songs</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tab === "songs" && (
        <div className="px-2 md:px-4">
          {!user && <Empty icon="❤️" title="Your songs live here" text="Sign in to see songs you've liked." href="/login" cta="Log in" />}
          {user && songs.length === 0 && <Empty icon="🎵" title="No liked songs yet" text="Tap the heart on any track to save it." href="/search" cta="Find music" />}
          <TrackList tracks={songs} />
        </div>
      )}

      {tab === "albums" && (
        <div className="px-4 md:px-6">
          {albums.length === 0 && <Empty icon="💿" title="No albums yet" text="Albums from liked songs and your history appear here." href="/search" cta="Browse albums" />}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {albums.map((a) => (
              <Link key={a.id} href={`/collection/${a.id}`}>
                <Artwork src={a.artwork} alt={a.name} iconSize={40} className="aspect-square w-full rounded-2xl shadow-lg" />
                <p className="mt-2 truncate text-sm font-semibold">{a.name}</p>
                <p className="truncate text-xs text-muted">{a.artist}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tab === "artists" && (
        <div className="px-4 md:px-6">
          {artists.length === 0 && <Empty icon="🎤" title="No artists yet" text="Artists you like and play often appear here." href="/search" cta="Discover artists" />}
          <div className="space-y-1">
            {artists.map((a) => (
              <Link key={a.id} href={`/artist/${a.id}`} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-white/5">
                <Artwork src={a.artwork} alt={a.name} className="h-14 w-14 rounded-full" />
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{a.name}</span><span className="text-xs text-muted">{a.n} {a.n === 1 ? "play" : "plays"}</span></span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tab === "local" && (
        <div className="px-2 md:px-4">
          <label className="glass mx-2 mb-3 flex cursor-pointer items-center gap-3 rounded-2xl p-3 hover:bg-white/15">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white"><FolderOpen size={20} /></span>
            <span><span className="block font-semibold">Import audio files</span><span className="text-xs text-muted">MP3, M4A, FLAC, WAV — stored on this device</span></span>
            <input type="file" accept="audio/*" multiple hidden onChange={(e) => { if (e.target.files?.length) importLocal(e.target.files, notify); e.target.value = ""; }} />
          </label>
          {localTracks.length === 0 && <p className="px-4 text-sm text-muted">No local files yet.</p>}
          <TrackList tracks={localTracks} onRemove={(t) => useLocal.getState().removeLocal(t.id)} removeLabel="Remove file" />
        </div>
      )}
      <div className="mt-8 px-4 text-center text-xs text-muted md:px-6">
        <Sparkles size={14} className="mx-auto mb-1 text-brand" /> Beatly keeps history, downloads and local files on this device only.
      </div>
    </div>
  );
}

function Empty({ icon, title, text, href, cta }: { icon: string; title: string; text: string; href: string; cta: string }) {
  return (
    <div className="mx-2 my-6 rounded-3xl bg-white/5 p-6 text-center">
      <p className="text-3xl">{icon}</p>
      <p className="mt-2 font-bold">{title}</p>
      <p className="text-sm text-muted">{text}</p>
      <Link href={href} className="mt-3 inline-block rounded-full bg-white px-4 py-1.5 text-sm font-bold text-black">{cta}</Link>
    </div>
  );
}
