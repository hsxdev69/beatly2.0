"use client";

import { create } from "zustand";
import type { Track } from "@/lib/types";
import { toSnapshot } from "@/lib/types";

export type UserInfo = { id: number; email: string; name: string } | null;
export type PlaylistInfo = {
  id: number;
  name: string;
  description: string | null;
  trackCount: number;
  artwork: string | null;
};

type LibraryState = {
  user: UserInfo;
  loaded: boolean;
  likedIds: Set<string>;
  playlists: PlaylistInfo[];
  toast: string | null;
  bootstrap: () => Promise<void>;
  setUser: (u: UserInfo) => void;
  isLiked: (id: string) => boolean;
  toggleLike: (track: Track) => Promise<void>;
  refreshPlaylists: () => Promise<void>;
  createPlaylist: (name: string, firstTrack?: Track) => Promise<PlaylistInfo | null>;
  addToPlaylist: (playlistId: number, track: Track) => Promise<void>;
  notify: (msg: string) => void;
};

export const useLibrary = create<LibraryState>()((set, get) => ({
  user: null,
  loaded: false,
  likedIds: new Set(),
  playlists: [],
  toast: null,

  bootstrap: async () => {
    try {
      const res = await fetch("/api/auth/me");
      const json = await res.json();
      if (json.user) {
        set({ user: json.user });
        const [likes, pls] = await Promise.all([
          fetch("/api/likes").then((r) => r.json()),
          fetch("/api/playlists").then((r) => r.json()),
        ]);
        set({
          likedIds: new Set<string>((likes.ids ?? []) as string[]),
          playlists: pls.playlists ?? [],
        });
      } else {
        set({ user: null, likedIds: new Set(), playlists: [] });
      }
    } finally {
      set({ loaded: true });
    }
  },
  setUser: (u) => set({ user: u }),
  isLiked: (id) => get().likedIds.has(id),
  toggleLike: async (track) => {
    const { user, likedIds, notify } = get();
    if (!user) return notify("Sign in to like songs");
    const next = new Set(likedIds);
    const liked = next.has(track.id);
    if (liked) next.delete(track.id);
    else next.add(track.id);
    set({ likedIds: next });
    const res = await fetch("/api/likes", {
      method: liked ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track: toSnapshot(track) }),
    });
    if (!res.ok) {
      set({ likedIds });
      notify("Something went wrong");
    } else notify(liked ? "Removed from Liked Songs" : "Added to Liked Songs");
  },
  refreshPlaylists: async () => {
    const res = await fetch("/api/playlists");
    if (res.ok) {
      const json = await res.json();
      set({ playlists: json.playlists ?? [] });
    }
  },
  createPlaylist: async (name, firstTrack) => {
    if (!get().user) {
      get().notify("Sign in to create playlists");
      return null;
    }
    const res = await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    const { playlist } = await res.json();
    if (firstTrack) await get().addToPlaylist(playlist.id, firstTrack);
    else await get().refreshPlaylists();
    get().notify(`Created "${name}"`);
    return playlist;
  },
  addToPlaylist: async (playlistId, track) => {
    const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track: toSnapshot(track) }),
    });
    if (res.ok) {
      const pl = get().playlists.find((p) => p.id === playlistId);
      get().notify(`Added to ${pl?.name ?? "playlist"}`);
      await get().refreshPlaylists();
    } else get().notify("Could not add track");
  },
  notify: (msg) => {
    set({ toast: msg });
    setTimeout(() => {
      if (get().toast === msg) set({ toast: null });
    }, 2500);
  },
}));
