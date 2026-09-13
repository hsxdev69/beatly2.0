"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X, Plus, ListMusic, Check } from "lucide-react";
import { useLibrary } from "@/store/library";
import type { Track } from "@/lib/types";
import { Artwork } from "@/components/Artwork";

type DialogState = { mode: "create" } | { mode: "add"; track: Track } | null;

export function openAddToPlaylist(track: Track) {
  window.dispatchEvent(new CustomEvent("beatly:add-to-playlist", { detail: track }));
}

export function PlaylistDialog() {
  const [state, setState] = useState<DialogState>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { user, playlists, createPlaylist, addToPlaylist, notify } = useLibrary();

  useEffect(() => {
    const onCreate = () => {
      setState({ mode: "create" });
      setName("");
    };
    const onAdd = (e: Event) => {
      if (!useLibrary.getState().user) {
        notify("Sign in to add songs to playlists");
        router.push("/login");
        return;
      }
      setState({ mode: "add", track: (e as CustomEvent<Track>).detail });
      setCreating(false);
      setName("");
    };
    window.addEventListener("beatly:create-playlist", onCreate);
    window.addEventListener("beatly:add-to-playlist", onAdd);
    return () => {
      window.removeEventListener("beatly:create-playlist", onCreate);
      window.removeEventListener("beatly:add-to-playlist", onAdd);
    };
  }, [notify, router]);

  const close = () => setState(null);

  async function submitCreate() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const pl = await createPlaylist(name.trim(), state?.mode === "add" ? state.track : undefined);
    setBusy(false);
    close();
    if (pl && state?.mode === "create") router.push(`/playlist/${pl.id}`);
  }

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={close}
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong w-full max-w-md rounded-3xl p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{state.mode === "create" ? "New playlist" : "Add to playlist"}</h3>
              <button onClick={close} className="rounded-full p-1.5 hover:bg-white/10">
                <X size={18} />
              </button>
            </div>

            {state.mode === "add" && (
              <div className="mt-3 flex items-center gap-3 rounded-md bg-black/30 p-2">
                <Artwork src={state.track.artwork} alt="" className="h-10 w-10 rounded" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{state.track.title}</p>
                  <p className="truncate text-xs text-muted">{state.track.artist}</p>
                </div>
              </div>
            )}

            {state.mode === "create" || creating ? (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!user) return router.push("/login");
                  submitCreate();
                }}
              >
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My playlist #1"
                  className="w-full rounded-2xl bg-white/10 px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
                />
                <div className="flex justify-end gap-2">
                  {creating && (
                    <button type="button" onClick={() => setCreating(false)} className="rounded-full px-4 py-2 text-sm font-semibold text-muted hover:text-white">
                      Back
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!name.trim() || busy}
                    className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white transition hover:scale-105 disabled:opacity-50"
                  >
                    {busy ? "Creating…" : "Create"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 max-h-72 space-y-1 overflow-y-auto">
                <button
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-white/5"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded bg-surface-4">
                    <Plus size={18} />
                  </span>
                  <span className="text-sm font-semibold">New playlist</span>
                </button>
                {playlists.map((p) => (
                  <button
                    key={p.id}
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      await addToPlaylist(p.id, state.track);
                      setBusy(false);
                      close();
                    }}
                    className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-white/5"
                  >
                    {p.artwork ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.artwork} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded bg-surface-4 text-muted">
                        <ListMusic size={18} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="text-xs text-muted">{p.trackCount} songs</p>
                    </div>
                    <Check size={16} className="text-transparent" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
