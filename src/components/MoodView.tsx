"use client";

import { Shuffle } from "lucide-react";
import type { Track } from "@/lib/types";
import type { MoodDef } from "@/lib/moods";
import { usePlayer } from "@/store/player";
import { TrackList } from "@/components/TrackList";
import { PageHeader, PlayAllButton } from "@/components/Cards";

export function MoodView({ mood, tracks }: { mood: MoodDef; tracks: Track[] }) {
  const playQueue = usePlayer((s) => s.playQueue);
  const total = tracks.reduce((a, t) => a + (t.duration || 0), 0);
  return (
    <div className="pb-6">
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-72" style={{ background: `linear-gradient(180deg, ${mood.from} 0%, ${mood.to} 60%, transparent 100%)`, opacity: 0.7 }} />
        <div className="relative">
          <PageHeader title="" back />
          <div className="flex items-end gap-4 px-4 pb-6 md:px-6">
            <div className="flex h-36 w-36 items-center justify-center rounded-3xl text-6xl shadow-2xl" style={{ background: `linear-gradient(135deg, ${mood.from}, ${mood.to})` }}>{mood.emoji}</div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-white/70">Mood playlist</p>
              <h1 className="text-3xl font-black md:text-5xl">{mood.label}</h1>
              <p className="mt-1 text-sm text-white/80">{tracks.length} songs · {Math.round(total / 60)} min</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3 md:px-6">
        <PlayAllButton tracks={tracks} />
        <button onClick={() => playQueue([...tracks].sort(() => Math.random() - 0.5))} className="glass rounded-full p-3 hover:bg-white/15" aria-label="Shuffle"><Shuffle size={20} /></button>
      </div>
      <div className="px-2 md:px-4">
        {tracks.length ? <TrackList tracks={tracks} /> : <p className="px-4 text-sm text-muted">Nothing found for this mood right now.</p>}
      </div>
    </div>
  );
}
