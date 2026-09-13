"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Shuffle } from "lucide-react";
import type { TrackSnapshot } from "@/db/schema";
import { fromSnapshot, type Track } from "@/lib/types";
import { useLibrary } from "@/store/library";
import { usePlayer } from "@/store/player";
import { TrackList } from "@/components/TrackList";
import { PageHeader, PlayAllButton, Skeleton } from "@/components/Cards";

export function LikedView() {
  const { user, loaded, likedIds } = useLibrary();
  const playQueue = usePlayer((s) => s.playQueue);
  const [tracks, setTracks] = useState<Track[] | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/likes").then((r) => r.json()).then((j) => setTracks((j.tracks as TrackSnapshot[]).map(fromSnapshot)));
  }, [user, likedIds.size]);

  const visible = tracks?.filter((t) => likedIds.has(t.id)) ?? null;

  return (
    <div className="pb-6">
      <PageHeader title="Liked" subtitle={`${likedIds.size} songs`} />
      <div className="flex items-center gap-4 px-4 pb-4 md:px-6">
        <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-rose-500 to-pink-700 shadow-2xl">
          <Heart size={52} fill="white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">{user ? `${user.name}'s favourites` : "Sign in to see your liked songs"}</p>
          <div className="mt-3 flex items-center gap-2">
            {visible && <PlayAllButton tracks={visible} />}
            {visible && visible.length > 1 && (
              <button onClick={() => playQueue([...visible].sort(() => Math.random() - 0.5))} className="glass rounded-full p-3 hover:bg-white/15" aria-label="Shuffle"><Shuffle size={20} /></button>
            )}
          </div>
        </div>
      </div>

      {loaded && !user && (
        <div className="mx-4 rounded-3xl bg-white/5 p-6 text-center md:mx-6">
          <p className="font-bold">Your favourites, everywhere</p>
          <p className="text-sm text-muted">Log in to sync liked songs across devices.</p>
          <Link href="/login" className="mt-3 inline-block rounded-full bg-white px-5 py-2 text-sm font-bold text-black">Log in</Link>
        </div>
      )}
      {user && (
        <div className="px-2 md:px-4">
          {!visible && <div className="space-y-2 px-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>}
          {visible && visible.length === 0 && <p className="px-4 text-sm text-muted">Tap the heart on any track to save it here.</p>}
          {visible && visible.length > 0 && <TrackList tracks={visible} />}
        </div>
      )}
    </div>
  );
}
