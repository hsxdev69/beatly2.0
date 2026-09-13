"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Pause, Heart, MoreHorizontal, ListPlus, ListEnd, Plus, Trash2, Download, CircleCheck, Mic2, Disc3, X } from "lucide-react";
import { usePlayer } from "@/store/player";
import { useLibrary } from "@/store/library";
import { useLocal } from "@/store/local";
import { formatDuration, type Track } from "@/lib/types";
import { formatBytes } from "@/lib/blobs";
import { cn } from "@/lib/utils";
import { Artwork } from "@/components/Artwork";
import { openAddToPlaylist } from "@/components/PlaylistDialog";
import { Sheet } from "@/components/Sheet";

export function TrackList({
  tracks,
  onRemove,
  removeLabel,
  numbered = true,
}: {
  tracks: Track[];
  onRemove?: (track: Track, index: number) => void;
  removeLabel?: string;
  numbered?: boolean;
}) {
  if (!tracks.length) return null;
  return (
    <div className="space-y-0.5">
      {tracks.map((t, i) => (
        <TrackRow key={`${t.id}-${i}`} track={t} index={i} context={tracks} onRemove={onRemove} removeLabel={removeLabel} numbered={numbered} />
      ))}
    </div>
  );
}

export function TrackRow({
  track,
  index,
  context,
  onRemove,
  removeLabel,
  numbered,
}: {
  track: Track;
  index: number;
  context: Track[];
  onRemove?: (track: Track, index: number) => void;
  removeLabel?: string;
  numbered?: boolean;
}) {
  const router = useRouter();
  const active = usePlayer((s) => s.queue[s.index]?.id === track.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const { playTrack, toggle, addToQueue, playNext } = usePlayer();
  const liked = useLibrary((s) => s.likedIds.has(track.id));
  const toggleLike = useLibrary((s) => s.toggleLike);
  const notify = useLibrary((s) => s.notify);
  const downloaded = useLocal((s) => !!s.downloads[track.id]);
  const dlSize = useLocal((s) => s.downloads[track.id]?.size);
  const progress = useLocal((s) => s.progress[track.id]);
  const { download, removeDownload } = useLocal();
  const [menu, setMenu] = useState(false);
  const isLocal = track.id.startsWith("local:");

  const onPlay = () => (active ? toggle() : playTrack(track, context));
  const go = (href: string) => {
    setMenu(false);
    router.push(href);
  };

  return (
    <div className={cn("group flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/5 md:px-3", active && "bg-white/5")}>
      {numbered && (
        <div className="hidden w-6 shrink-0 items-center justify-center md:flex">
          {active && isPlaying ? (
            <span className="flex h-4 items-end gap-0.5 group-hover:hidden">
              <span className="eq-bar w-0.5 bg-brand" />
              <span className="eq-bar w-0.5 bg-brand" />
              <span className="eq-bar w-0.5 bg-brand" />
            </span>
          ) : (
            <span className={cn("text-sm tabular-nums group-hover:hidden", active ? "text-brand" : "text-muted")}>{index + 1}</span>
          )}
          <button onClick={onPlay} className="hidden text-white group-hover:block" aria-label="Play">
            {active && isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>
        </div>
      )}

      <button onClick={onPlay} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="relative shrink-0">
          <Artwork src={track.artwork} alt={track.title} className="h-12 w-12 rounded-xl" />
          <span className={cn("absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 transition md:hidden", active ? "opacity-100" : "opacity-0")}>
            {active && isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" />}
          </span>
        </div>
        <div className="min-w-0">
          <p className={cn("truncate text-sm font-semibold", active && "text-brand")}>{track.title}</p>
          <p className="flex items-center gap-1 truncate text-xs text-muted">
            {downloaded && <CircleCheck size={12} className="shrink-0 text-brand" />}
            {progress !== undefined && <span className="shrink-0 text-brand">{Math.round(progress * 100)}% ·</span>}
            <span className="truncate">{track.artist}</span>
            {track.album && <span className="hidden truncate md:inline"> · {track.album}</span>}
          </p>
        </div>
      </button>

      <span className="hidden text-xs tabular-nums text-muted sm:block">{track.duration ? formatDuration(track.duration) : ""}</span>
      {!isLocal && (
        <button
          onClick={() => toggleLike(track)}
          className={cn("rounded-full p-1.5 transition", liked ? "text-brand" : "text-muted hover:text-white md:opacity-0 md:group-hover:opacity-100")}
          aria-label="Like"
        >
          <Heart size={17} fill={liked ? "currentColor" : "none"} />
        </button>
      )}
      <button onClick={() => setMenu(true)} className="rounded-full p-1.5 text-muted hover:text-white" aria-label="More">
        <MoreHorizontal size={18} />
      </button>

      <Sheet open={menu} onClose={() => setMenu(false)}>
        <div className="mb-3 flex items-center gap-3">
          <Artwork src={track.artwork} alt="" className="h-14 w-14 rounded-xl" />
          <div className="min-w-0">
            <p className="truncate font-bold">{track.title}</p>
            <p className="truncate text-sm text-muted">{track.artist}</p>
          </div>
          <button onClick={() => setMenu(false)} className="ml-auto rounded-full p-1.5 text-muted hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-0.5">
          <Item icon={ListEnd} label="Play next" onClick={() => { playNext(track); notify("Playing next"); setMenu(false); }} />
          <Item icon={ListPlus} label="Add to queue" onClick={() => { addToQueue(track); notify("Added to queue"); setMenu(false); }} />
          {!isLocal && <Item icon={Plus} label="Add to playlist" onClick={() => { setMenu(false); openAddToPlaylist(track); }} />}
          {!isLocal && <Item icon={Heart} label={liked ? "Remove from Liked" : "Add to Liked"} onClick={() => { toggleLike(track); setMenu(false); }} />}
          {!isLocal && (downloaded ? (
            <Item icon={Trash2} label="Remove download" hint={dlSize ? formatBytes(dlSize) : undefined} onClick={() => { removeDownload(track.id); notify("Download removed"); setMenu(false); }} />
          ) : (
            <Item icon={Download} label={progress !== undefined ? "Downloading…" : "Download"} hint="Listen offline" onClick={() => { download(track, notify); setMenu(false); }} />
          ))}
          {track.artistId && <Item icon={Mic2} label="Go to artist" hint={track.artist} onClick={() => go(`/artist/${track.artistId}`)} />}
          {track.albumId && <Item icon={Disc3} label="Go to album" hint={track.album ?? undefined} onClick={() => go(`/collection/${track.albumId}`)} />}
          {onRemove && <Item icon={Trash2} label={removeLabel ?? "Remove from this list"} onClick={() => { onRemove(track, index); setMenu(false); }} danger />}
        </div>
      </Sheet>
    </div>
  );
}

function Item({ icon: Icon, label, hint, onClick, danger }: { icon: typeof Play; label: string; hint?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-white/5">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-white/10", danger && "text-red-400")}><Icon size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-semibold", danger && "text-red-400")}>{label}</span>
        {hint && <span className="block truncate text-xs text-muted">{hint}</span>}
      </span>
    </button>
  );
}
