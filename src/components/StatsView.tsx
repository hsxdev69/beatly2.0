"use client";

import Link from "next/link";
import { fromSnapshot, formatDuration } from "@/lib/types";
import { useLocal } from "@/store/local";
import { usePlayer } from "@/store/player";
import { Artwork } from "@/components/Artwork";
import { PageHeader } from "@/components/Cards";

export function StatsView() {
  const { counts, history } = useLocal();
  const playTrack = usePlayer((s) => s.playTrack);
  const entries = Object.values(counts);
  const totalPlays = entries.reduce((a, c) => a + c.n, 0);
  const minutes = Math.round(entries.reduce((a, c) => a + c.n * (c.track.duration || 0), 0) / 60);
  const top = [...entries].sort((a, b) => b.n - a.n).slice(0, 10);
  const max = top[0]?.n ?? 1;
  const artists = new Map<string, { name: string; artwork: string | null; id: string; n: number }>();
  for (const c of entries) {
    const key = c.track.artistId || c.track.artist;
    const e = artists.get(key);
    if (e) e.n += c.n;
    else artists.set(key, { name: c.track.artist, artwork: c.track.artwork, id: c.track.artistId, n: c.n });
  }
  const topArtists = [...artists.values()].sort((a, b) => b.n - a.n).slice(0, 6);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    const n = history.filter((h) => h.at >= d.getTime() && h.at < d.getTime() + 86400000).length;
    return { label: d.toLocaleDateString(undefined, { weekday: "narrow" }), n };
  });
  const weekMax = Math.max(1, ...week.map((w) => w.n));
  const tracks = top.map((c) => fromSnapshot(c.track));

  return (
    <div className="pb-6">
      <PageHeader title="Statistics" subtitle="Your listening trends" />
      <div className="grid grid-cols-3 gap-2 px-4 md:px-6">
        <Stat label="Plays" value={String(totalPlays)} />
        <Stat label="Minutes" value={String(minutes)} />
        <Stat label="Artists" value={String(artists.size)} />
      </div>

      <section className="mx-4 mt-4 rounded-3xl bg-white/5 p-4 md:mx-6">
        <p className="mb-3 text-sm font-bold">This week</p>
        <div className="flex h-28 items-end gap-2">
          {week.map((w, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t-lg bg-gradient-to-t from-brand to-pink-400" style={{ height: `${Math.max(4, (w.n / weekMax) * 100)}%` }} />
              <span className="text-[10px] text-muted">{w.label}</span>
            </div>
          ))}
        </div>
      </section>

      {topArtists.length > 0 && (
        <section className="mt-6">
          <p className="px-4 pb-2 text-sm font-bold md:px-6">Top artists</p>
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 md:px-6">
            {topArtists.map((a) => (
              <Link key={a.id || a.name} href={a.id ? `/artist/${a.id}` : "#"} className="w-24 shrink-0 text-center">
                <Artwork src={a.artwork} alt={a.name} className="aspect-square w-full rounded-full" />
                <p className="mt-1 truncate text-xs font-semibold">{a.name}</p>
                <p className="text-[10px] text-muted">{a.n} plays</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6 px-4 md:px-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">Top tracks</p>
          <Link href="/folder/top" className="text-xs font-bold text-brand">My top 50</Link>
        </div>
        {top.length === 0 && <p className="mt-2 text-sm text-muted">Start listening to see your trends.</p>}
        <div className="mt-2 space-y-1">
          {top.map((c, i) => (
            <button key={c.track.id} onClick={() => playTrack(fromSnapshot(c.track), tracks)} className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl p-2 text-left hover:bg-white/5">
              <span className="absolute inset-y-0 left-0 bg-brand/10" style={{ width: `${(c.n / max) * 100}%` }} />
              <span className="relative w-5 text-center text-sm font-bold text-muted">{i + 1}</span>
              <Artwork src={c.track.artwork} alt="" className="relative h-11 w-11 rounded-xl" />
              <span className="relative min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{c.track.title}</span>
                <span className="block truncate text-xs text-muted">{c.track.artist} · {formatDuration(c.track.duration)}</span>
              </span>
              <span className="relative text-sm font-bold">{c.n}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-3 text-center">
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
