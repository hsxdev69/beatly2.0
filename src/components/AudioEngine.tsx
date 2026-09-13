"use client";

/**
 * Persistent background audio engine for Beatly.
 *
 * IMPORTANT: online playback always uses the persistent HTML5 <audio> element
 * and /api/stream/{videoId}. This is the browser media path that Android can
 * keep alive with MediaSession when the screen is locked. No hidden iframe is
 * used for playback: hidden YouTube iframes are foreground-only and can be
 * suspended by Android, which breaks lock-screen playback.
 *
 * The <audio> element is mounted once in AppShell, independent from screen
 * navigation. MediaSession metadata/actions are also registered independently
 * from the visible player UI.
 */
import { useEffect, useRef } from "react";
import { usePlayer } from "@/store/player";
import { useLocal } from "@/store/local";
import { useLibrary } from "@/store/library";
import { streamPath, type Track } from "@/lib/types";
import { getBlobUrl } from "@/lib/blobs";

/** Used by the audio-output picker. */
export const audioElement: { current: HTMLAudioElement | null } = { current: null };

const RETRY_DELAYS = [1500, 5000, 15000, 45000, 90000];

function setMediaMetadata(track: Track | null) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.metadata = track
      ? new MediaMetadata({
          title: track.title || "Unknown title",
          artist: track.artist || "Unknown artist",
          album: track.album ?? "Beatly",
          artwork: track.artwork
            ? [
                { src: track.artwork, sizes: "544x544", type: "image/jpeg" },
                {
                  src: track.artwork.replace(/=w\d+-h\d+[^&]*/, "=w256-h256-l90-rj"),
                  sizes: "256x256",
                  type: "image/jpeg",
                },
              ]
            : [],
        })
      : null;
  } catch {
    /* MediaMetadata is unavailable in some browsers. */
  }
}

function syncMediaPlaybackState() {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    const state = usePlayer.getState();
    navigator.mediaSession.playbackState = state.current() ? (state.isPlaying ? "playing" : "paused") : "none";
  } catch {
    /* ignore */
  }
}

function syncMediaPosition() {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    const { currentTime, duration } = usePlayer.getState();
    if (!duration || !isFinite(duration) || !isFinite(currentTime)) return;
    navigator.mediaSession.setPositionState({
      duration,
      position: Math.max(0, Math.min(currentTime, duration)),
      playbackRate: 1,
    });
  } catch {
    /* ignore */
  }
}

export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeSourceRef = useRef<"audio" | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const loadedTrackRef = useRef<string | null>(null);
  const loadGenerationRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryStateRef = useRef({ id: "", attempts: 0 });
  const pendingSeekRef = useRef(0);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const seekTo = usePlayer((s) => s.seekTo);
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const track = queue[index] ?? null;
  const nextTrack = queue[index + 1] ?? null;

  const clearRetry = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const releaseBlob = () => {
    const url = blobUrlRef.current;
    blobUrlRef.current = null;
    // Give the media element a moment to detach before revoking the object URL.
    if (url) setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const playAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const promise = audio.play();
    playPromiseRef.current = promise;
    promise
      .then(() => {
        console.info("[AudioEngine] playback started");
        syncMediaPlaybackState();
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        // Do not permanently flip the store to paused here. On Android/iOS a
        // play promise can be rejected until the user's first media gesture;
        // the gesture recovery listener below retries without losing state.
        console.warn("[AudioEngine] play() rejected:", err instanceof Error ? err.message : err);
      })
      .finally(() => {
        if (playPromiseRef.current === promise) playPromiseRef.current = null;
      });
  };

  /* ---------------- Persistent audio element + media event handlers ---------------- */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audioElement.current = audio;
    audio.volume = muted ? 0 : Math.max(0, Math.min(1, volume));
    audio.muted = muted;

    // This listener is the critical Android/Safari fix. `playTrack()` emits
    // this synchronously from the user's tap, so setting src + play() happens
    // inside the browser's transient user-activation window instead of waiting
    // for a later React effect (which autoplay policy may reject).
    const onImmediatePlay = (event: Event) => {
      const requested = (event as CustomEvent<Track>).detail;
      if (!requested || requested.id.startsWith("local:")) return;
      const state = usePlayer.getState();
      const current = state.current();
      if (!current || current.id !== requested.id) return;
      const src = streamPath(requested.videoId || requested.id);
      activeSourceRef.current = "audio";
      loadedTrackRef.current = requested.id;
      audio.src = src;
      audio.load();
      playAudio();
    };
    window.addEventListener("beatly:play-request", onImmediatePlay);

    // A user gesture can also unlock an existing source after an autoplay
    // rejection, without requiring a second click on the play button.
    const unlock = () => {
      if (usePlayer.getState().isPlaying && audio.paused && audio.src) playAudio();
    };
    document.addEventListener("click", unlock);
    document.addEventListener("touchend", unlock);

    return () => {
      window.removeEventListener("beatly:play-request", onImmediatePlay);
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchend", unlock);
      audioElement.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Load one track into the persistent audio element ---------------- */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const generation = ++loadGenerationRef.current;
    clearRetry();
    pendingSeekRef.current = 0;

    if (!track) {
      loadedTrackRef.current = null;
      releaseBlob();
      audio.removeAttribute("src");
      audio.load();
      usePlayer.getState().setProgress(0, 0);
      setMediaMetadata(null);
      syncMediaPlaybackState();
      return;
    }

    const trackId = track.id;
    const videoId = track.videoId || track.id;

    // A card click can synchronously assign/play the source through the
    // `beatly:play-request` event before this React effect runs. Keep that
    // user-activated source instead of replacing it a second time.
    if (loadedTrackRef.current === trackId && audio.src) {
      if (usePlayer.getState().isPlaying) playAudio();
      return;
    }

    loadedTrackRef.current = null;
    retryStateRef.current = { id: trackId, attempts: 0 };
    releaseBlob();
    setMediaMetadata(track);
    usePlayer.getState().setProgress(0, track.duration || 0);
    useLocal.getState().recordPlay(track);

    const setSource = (src: string) => {
      if (generation !== loadGenerationRef.current) return;
      audio.src = src;
      loadedTrackRef.current = trackId;
      // load() is required to restart the media resource selection after a
      // new URL. Playback begins from canplay/play or the user gesture retry.
      audio.load();
      if (usePlayer.getState().isPlaying) playAudio();
    };

    const isLocal = trackId.startsWith("local:");
    const isDownloaded = !!useLocal.getState().downloads[trackId];
    if (isLocal || isDownloaded) {
      getBlobUrl(trackId)
        .catch(() => null)
        .then((url) => {
          if (generation !== loadGenerationRef.current) {
            if (url) URL.revokeObjectURL(url);
            return;
          }
          if (url) {
            blobUrlRef.current = url;
            setSource(url);
          } else if (!isLocal) {
            useLocal.getState().removeDownload(trackId).catch(() => {});
            setSource(streamPath(videoId));
          } else {
            useLibrary.getState().notify("Local file is unavailable");
            usePlayer.getState().next(true);
          }
        });
    } else {
      // Primary online path — persistent HTML5 audio, not an iframe.
      setSource(streamPath(videoId));
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  /* ---------------- Play / pause ---------------- */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (isPlaying) {
      if (audio.paused) playAudio();
    } else if (!audio.paused) {
      audio.pause();
    }
    syncMediaPlaybackState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, track]);

  /* ---------------- Volume / mute ---------------- */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : Math.max(0, Math.min(1, volume));
    audio.muted = muted;
  }, [volume, muted]);

  /* ---------------- Seek ---------------- */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || seekTo === null) return;
    if (isFinite(seekTo)) {
      try {
        audio.currentTime = seekTo;
      } catch {
        pendingSeekRef.current = seekTo;
      }
    }
    usePlayer.getState().clearSeek();
  }, [seekTo]);

  /* ---------------- MediaSession: action handlers owned for the whole app lifetime ---------------- */
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const state = usePlayer.getState;
    const actions: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ["play", () => state().setPlaying(true)],
      ["pause", () => state().setPlaying(false)],
      ["stop", () => state().setPlaying(false)],
      ["previoustrack", () => state().prev()],
      ["nexttrack", () => state().next()],
      ["seekto", (d) => d.seekTime != null && state().requestSeek(d.seekTime)],
      ["seekbackward", (d) => state().requestSeek(Math.max(0, state().currentTime - (d.seekOffset ?? 10)))],
      ["seekforward", (d) => state().requestSeek(state().currentTime + (d.seekOffset ?? 10))],
    ];
    for (const [action, handler] of actions) {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* action not supported on this browser */
      }
    }
    return () => {
      for (const [action] of actions) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  useEffect(() => {
    setMediaMetadata(track);
    syncMediaPlaybackState();
  }, [track, isPlaying]);

  useEffect(() => {
    syncMediaPosition();
  }, [currentTime, duration]);

  /* ---------------- Background/foreground/network recovery ---------------- */
  useEffect(() => {
    const revive = () => {
      syncMediaPlaybackState();
      syncMediaPosition();
      const audio = audioRef.current;
      if (usePlayer.getState().isPlaying && audio?.paused) playAudio();
    };
    const online = () => {
      // A fresh source is helpful after Wi-Fi ↔ mobile handoff.
      const s = usePlayer.getState();
      const t = s.current();
      if (s.isPlaying && t && !t.id.startsWith("local:")) {
        pendingSeekRef.current = s.currentTime;
        audioRef.current?.setAttribute("src", streamPath(t.videoId || t.id, true));
        audioRef.current?.load();
        playAudio();
      }
    };
    document.addEventListener("visibilitychange", revive);
    window.addEventListener("pageshow", revive);
    window.addEventListener("online", online);
    return () => {
      document.removeEventListener("visibilitychange", revive);
      window.removeEventListener("pageshow", revive);
      window.removeEventListener("online", online);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Next track pre-warm ---------------- */
  useEffect(() => {
    if (!nextTrack || nextTrack.id.startsWith("local:") || useLocal.getState().settings.dataSaver) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(streamPath(nextTrack.videoId || nextTrack.id), { method: "HEAD", signal: ctrl.signal }).catch(() => {});
    }, 4000);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [nextTrack]);

  /* ---------------- Keyboard shortcut ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.code === "Space") {
        e.preventDefault();
        usePlayer.getState().toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------------- Media error recovery ---------------- */
  const onAudioError = () => {
    const s = usePlayer.getState();
    const t = s.current();
    const audio = audioRef.current;
    if (!t || !audio) return;
    const id = t.id;
    const videoId = t.videoId || id;
    if (id.startsWith("local:")) {
      s.next(true);
      return;
    }
    if (retryTimerRef.current) return;
    const retry = retryStateRef.current;
    if (retry.id !== id) retryStateRef.current = { id, attempts: 0 };
    retryStateRef.current.attempts += 1;
    const n = retryStateRef.current.attempts;
    if (n <= RETRY_DELAYS.length) {
      const position = isFinite(audio.currentTime) ? audio.currentTime : 0;
      pendingSeekRef.current = position;
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        const current = usePlayer.getState().current();
        if (!current || current.id !== id) return;
        audio.src = streamPath(videoId, true);
        audio.load();
        if (usePlayer.getState().isPlaying) playAudio();
      }, RETRY_DELAYS[n - 1]);
      return;
    }
    useLibrary.getState().notify(`Couldn't play "${t.title}" — skipped`);
    if (s.queue.length > 1) setTimeout(() => usePlayer.getState().next(true), 400);
    else s.setPlaying(false);
  };

  return (
    <audio
      ref={audioRef}
      preload="auto"
      playsInline
      aria-hidden="true"
      style={{ position: "fixed", top: -9999, left: -9999, opacity: 0, pointerEvents: "none" }}
      onTimeUpdate={() => {
        const audio = audioRef.current;
        if (!audio) return;
        const d = isFinite(audio.duration) ? audio.duration : track?.duration || 0;
        usePlayer.getState().setProgress(audio.currentTime, d);
      }}
      onLoadedMetadata={() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (pendingSeekRef.current > 1) {
          try {
            audio.currentTime = pendingSeekRef.current;
          } catch {
            /* ignore */
          }
          pendingSeekRef.current = 0;
        }
        if (isFinite(audio.duration)) usePlayer.getState().setProgress(audio.currentTime, audio.duration);
      }}
      onPlay={() => usePlayer.getState().setPlaying(true)}
      onPlaying={() => {
        retryStateRef.current = { id: retryStateRef.current.id, attempts: 0 };
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }}
      onPause={() => {
        const audio = audioRef.current;
        if (audio && !audio.ended && !audio.seeking) usePlayer.getState().setPlaying(false);
      }}
      onEnded={() => usePlayer.getState().next(true)}
      onError={onAudioError}
    />
  );
}
