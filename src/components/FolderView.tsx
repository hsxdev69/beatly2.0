"use client";

import Link from "next/link";
import { FolderOpen, Trash2, Shuffle, CloudUpload } from "lucide-react";
import { fromSnapshot, type Track } from "@/lib/types";
import { useLocal } from "@/store/local";
import { useLibrary } from "@/store/library";
import { usePlayer } from "@/store/player";
import { TrackList } from "@/components/TrackList";
import { PageHeader, PlayAllButton } from "@/components/Cards";
import { formatBytes } from "@/lib/blobs";

export type FolderKind = "downloaded" | "cached" | "uploaded" | "top" | "local";

const META: Record<FolderKind, { title: string; emoji: string; grad: string; subtitle: string }> = {
  downloaded: { title: "Downloaded", emoji: "📥", grad: "from-emerald-500 to-teal-700", subtitle: "Available offline" },
  cached: { title: "Cached", emoji: "🔄", grad: "from-sky-500 to-indigo-700", subtitle: "Recently streamed tracks" },
  uploaded: { title: "Uploaded", emoji: "☁️", grad: "from-slate-500 to-slate-800", subtitle: "Cloud-synced uploads" },
  top: { title: "My top 50", emoji: "📈", grad: "from-amber-500 to-orange-700", subtitle: "Your most played, auto-generated" },
  local: { title: "Local", emoji: "📁", grad: "from-violet-500 to-purple-800", subtitle: "Audio files on this device" },
};

export function FolderView({ kind }: { kind: FolderKind }) {
  const { downloads, history, local, importLocal, removeDownload, removeLocal, clearHistory, topTracks } = useLocal();
  const notify = useLibrary((s) => s.notify);
  const playQueue = usePlayer((s) => s.playQueue);
  const m = META[kind];

  let tracks: Track[] = [];
  let onRemove: ((t: Track) => void) | undefined;
  let removeLabel: string | undefined;
  let extra: string | undefined;
  if (kind === "downloaded") {
    // Offline section: hydrate every stored record into a full Track
    // (videoId, title, artist, artwork, duration) so clicking a row routes
    // through the exact same playTrack(track, context) pipeline as Home/Search.
    const list = Object.values(downloads)
      .filter((d) => d?.track?.id)
      .sort((a, b) => b.at - a.at);
    tracks = list.map((d) => fromSnapshot(d.track));
    extra = formatBytes(list.reduce((a, d) => a + d.size, 0));
    onRemove = (t) => removeDownload(t.id);
    removeLabel = "Remove download";
  } else if (kind === "cached") {
    tracks = history.map((h) => fromSnapshot(h.track));
  } else if (kind === "top") {
    tracks = topTracks(50).map(fromSnapshot);
  } else if (kind === "local") {
    const list = Object.values(local).sort((a, b) => b.at - a.at);
    tracks = list.map((l) => fromSnapshot(l.track));
    extra = formatBytes(list.reduce((a, l) => a + l.size, 0));
    onRemove = (t) => removeLocal(t.id);
    removeLabel = "Remove file";
  }

  return (
    <div className="pb-6">
      <PageHeader title={m.title} subtitle={`${tracks.length} songs${extra ? ` · ${extra}` : ""}`} />
      <div className="flex items-center gap-4 px-4 pb-4 md:px-6">
        <div className={`flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br text-5xl shadow-2xl ${m.grad}`}>{m.emoji}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">{m.subtitle}</p>
          <div className="mt-3 flex items-center gap-2">
            <PlayAllButton tracks={tracks} />
            {tracks.length > 1 && (
              <button onClick={() => playQueue([...tracks].sort(() => Math.random() - 0.5))} className="glass rounded-full p-3 hover:bg-white/15" aria-label="Shuffle"><Shuffle size={20} /></button>
            )}
            {kind === "cached" && tracks.length > 0 && (
              <button onClick={() => { clearHistory(); notify("Cache cleared"); }} className="glass rounded-full p-3 hover:bg-white/15" aria-label="Clear"><Trash2 size={20} /></button>
            )}
          </div>
        </div>
      </div>

      {kind === "local" && (
        <label className="glass mx-4 mb-3 flex cursor-pointer items-center gap-3 rounded-2xl p-3 hover:bg-white/15 md:mx-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white"><FolderOpen size={20} /></span>
          <span><span className="block font-semibold">Import audio files</span><span className="text-xs text-muted">Stored privately on this device</span></span>
          <input type="file" accept="audio/*" multiple hidden onChange={(e) => { if (e.target.files?.length) importLocal(e.target.files, notify); e.target.value = ""; }} />
        </label>
      )}

      {kind === "uploaded" && (
        <div className="mx-4 rounded-3xl bg-white/5 p-6 text-center md:mx-6">
          <CloudUpload size={32} className="mx-auto text-muted" />
          <p className="mt-2 font-bold">Cloud uploads coming soon</p>
          <p className="text-sm text-muted">Until then, import files to your Local folder to play them anywhere on this device.</p>
          <Link href="/folder/local" className="mt-3 inline-block rounded-full bg-white px-4 py-1.5 text-sm font-bold text-black">Go to Local</Link>
        </div>
      )}

      {kind !== "uploaded" && tracks.length === 0 && (
        <div className="mx-4 rounded-3xl bg-white/5 p-6 text-center md:mx-6">
          <p className="text-3xl">{m.emoji}</p>
          <p className="mt-2 font-bold">Nothing here yet</p>
          <p className="text-sm text-muted">
            {kind === "downloaded" && "Use the download button on any track to save it for offline listening."}
            {kind === "cached" && "Tracks you stream will show up here for quick replay."}
            {kind === "top" && "Keep listening — your top 50 builds itself from your plays."}
            {kind === "local" && "Import audio files from your device to play them here."}
          </p>
        </div>
      )}
      <div className="px-2 md:px-4">
        <TrackList tracks={tracks} onRemove={onRemove} removeLabel={removeLabel} />
      </div>
    </div>
  );
}
