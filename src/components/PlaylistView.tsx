"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListMusic, Pencil, Trash2, Search } from "lucide-react";
import type { TrackSnapshot } from "@/db/schema";
import { formatDuration, fromSnapshot, type Track } from "@/lib/types";
import { useLibrary } from "@/store/library";
import { TrackList } from "@/components/TrackList";
import { PageHeader, PlayAllButton, Skeleton } from "@/components/Cards";

type Row = { rowId: number; track: TrackSnapshot };
type Playlist = { id: number; name: string; description: string | null };

export function PlaylistView({ id }: { id: number }) {
  const router = useRouter();
  const { user, loaded, refreshPlaylists, notify, playlists } = useLibrary();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/playlists/${id}`);
    if (!res.ok) return setMissing(true);
    const j = await res.json();
    setPlaylist(j.playlist);
    setRows(j.tracks);
  }, [id]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Reload when a track gets added via the dialog (playlist counts change)
  const count = playlists.find((p) => p.id === id)?.trackCount;
  useEffect(() => {
    if (user && rows && count !== undefined && count !== rows.length) load();
  }, [count, user, rows, load]);

  const tracks: Track[] = rows?.map((r) => fromSnapshot(r.track)) ?? [];
  const total = tracks.reduce((a, t) => a + t.duration, 0);

  async function removeTrack(_t: Track, index: number) {
    const row = rows?.[index];
    if (!row) return;
    setRows((r) => r?.filter((x) => x.rowId !== row.rowId) ?? null);
    await fetch(`/api/playlists/${id}/tracks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowId: row.rowId }),
    });
    refreshPlaylists();
    notify("Removed from playlist");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/playlists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: desc }),
    });
    if (res.ok) {
      const j = await res.json();
      setPlaylist(j.playlist);
      setEditing(false);
      refreshPlaylists();
      notify("Playlist updated");
    }
  }

  async function deletePlaylist() {
    if (!confirm(`Delete "${playlist?.name}"? This can't be undone.`)) return;
    await fetch(`/api/playlists/${id}`, { method: "DELETE" });
    await refreshPlaylists();
    notify("Playlist deleted");
    router.push("/library");
  }

  if (loaded && !user)
    return (
      <div className="px-4 pt-6 md:px-6">
        <p className="text-muted">Sign in to view this playlist.</p>
        <Link href="/login" className="mt-4 inline-block rounded-full bg-white px-6 py-2.5 font-bold text-black">
          Log in
        </Link>
      </div>
    );
  if (missing)
    return (
      <div className="px-4 pt-6 md:px-6">
        <h1 className="text-2xl font-bold">Playlist not found</h1>
        <Link href="/library" className="mt-3 inline-block text-brand hover:underline">
          Back to library
        </Link>
      </div>
    );
  if (!playlist || !rows)
    return (
      <div className="px-4 pt-2 md:px-6">
        <div className="flex gap-5">
          <Skeleton className="h-56 w-56" />
          <div className="flex-1 space-y-3 self-end">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      </div>
    );

  const cover = tracks.find((t) => t.artwork)?.artwork;

  return (
    <div className="pb-6">
      <PageHeader title="" />
      <div className="flex flex-col items-center gap-5 px-4 pb-6 md:flex-row md:items-end md:px-6">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-48 w-48 rounded-3xl object-cover shadow-2xl md:h-56 md:w-56" />
        ) : (
          <div className="flex h-48 w-48 items-center justify-center rounded-3xl bg-white/10 shadow-2xl md:h-56 md:w-56">
            <ListMusic size={72} className="text-muted" />
          </div>
        )}
        <div className="min-w-0 flex-1 text-center md:text-left">
          <p className="text-sm font-semibold">Playlist</p>
          {editing ? (
            <form onSubmit={saveEdit} className="mt-2 max-w-md space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md bg-white/10 px-3 py-2 text-xl font-bold outline-none focus:ring-2 focus:ring-white/50"
              />
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Add an optional description"
                rows={2}
                className="w-full rounded-md bg-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/50"
              />
              <div className="flex gap-2">
                <button type="submit" className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-black">
                  Save
                </button>
                <button type="button" onClick={() => setEditing(false)} className="rounded-full px-4 py-1.5 text-sm font-bold text-muted">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="mt-1 truncate text-3xl font-black md:text-5xl">{playlist.name}</h1>
              {playlist.description && <p className="mt-2 text-sm text-white/70">{playlist.description}</p>}
              <p className="mt-3 text-sm text-white/80">
                <span className="font-semibold">{user?.name}</span> · {tracks.length} songs
                {total > 0 && `, ${formatDuration(total)}`}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-3 md:px-6">
        <PlayAllButton tracks={tracks} />
        <button
          onClick={() => {
            setName(playlist.name);
            setDesc(playlist.description ?? "");
            setEditing(true);
          }}
          className="rounded-full p-3 text-muted hover:text-white"
          title="Edit details"
        >
          <Pencil size={20} />
        </button>
        <button onClick={deletePlaylist} className="rounded-full p-3 text-muted hover:text-red-400" title="Delete playlist">
          <Trash2 size={20} />
        </button>
      </div>

      <div className="px-2 md:px-4">
        {tracks.length === 0 ? (
          <div className="mx-2 rounded-3xl bg-white/5 p-6">
            <p className="font-bold">Let&apos;s find something for your playlist</p>
            <p className="mt-1 text-sm text-muted">Search for songs and use the ••• menu to add them here.</p>
            <Link href="/search" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-black">
              <Search size={16} /> Search songs
            </Link>
          </div>
        ) : (
          <TrackList tracks={tracks} onRemove={removeTrack} removeLabel="Remove from this playlist" />
        )}
      </div>
    </div>
  );
}
