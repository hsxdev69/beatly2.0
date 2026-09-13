"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AudioLines, Timer, SlidersHorizontal, FolderOpen, ListMusic, Sparkles, Check, Speaker, Share2, Users, Link2,
  Disc3, Mic2, Plus, ListEnd, ListPlus, Download, Trash2, Globe, Heart,
} from "lucide-react";
import { EQ_BANDS, EQ_PRESETS, usePlayer } from "@/store/player";
import { useLibrary } from "@/store/library";
import { useLocal } from "@/store/local";
import { Sheet } from "@/components/Sheet";
import { Artwork } from "@/components/Artwork";
import { audioElement } from "@/components/AudioEngine";
import { openAddToPlaylist } from "@/components/PlaylistDialog";
import { GENRES } from "@/lib/moods";
import { formatBytes } from "@/lib/blobs";
import { cn } from "@/lib/utils";

export function Sheets() {
  const sheet = usePlayer((s) => s.sheet);
  const openSheet = usePlayer((s) => s.openSheet);
  const close = () => openSheet(null);
  return (
    <>
      <FabSheet open={sheet === "fab"} onClose={close} />
      <SleepSheet open={sheet === "sleep"} onClose={close} />
      <EqSheet open={sheet === "eq"} onClose={close} />
      <AudioSheet open={sheet === "audio"} onClose={close} />
      <GroupSheet open={sheet === "group"} onClose={close} />
      <RegionSheet open={sheet === "region"} onClose={close} />
      <MoreSheet open={sheet === "more"} onClose={close} />
    </>
  );
}

function Row({ icon: Icon, label, hint, onClick, href, accent }: { icon: typeof Timer; label: string; hint?: string; onClick?: () => void; href?: string; accent?: boolean }) {
  const inner = (
    <>
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", accent ? "bg-brand text-white" : "bg-white/10 text-white")}>
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block truncate text-xs text-muted">{hint}</span>}
      </span>
    </>
  );
  const cls = "flex w-full items-center gap-3 rounded-2xl p-2 transition hover:bg-white/5";
  return href ? (
    <Link href={href} onClick={onClick} className={cls}>{inner}</Link>
  ) : (
    <button onClick={onClick} className={cls}>{inner}</button>
  );
}

/* ---------------- Floating action menu ---------------- */
function FabSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const openSheet = usePlayer((s) => s.openSheet);
  const setQueueOpen = usePlayer((s) => s.setQueueOpen);
  const importLocal = useLocal((s) => s.importLocal);
  const notify = useLibrary((s) => s.notify);
  const fileRef = useRef<HTMLInputElement>(null);
  const sleep = usePlayer((s) => s.sleep);
  return (
    <Sheet open={open} onClose={onClose} title="Quick actions">
      <div className="space-y-1">
        <Row icon={AudioLines} label="Recognize Music" hint="Identify what's playing around you" href="/recognize" onClick={onClose} accent />
        <Row icon={Timer} label="Sleep timer" hint={sleep.endsAt ? "Timer running" : sleep.atTrackEnd ? "Stops after this track" : "Pause playback automatically"} onClick={() => openSheet("sleep")} />
        <Row icon={SlidersHorizontal} label="Equalizer" hint="Presets & 5-band control" onClick={() => openSheet("eq")} />
        <Row icon={ListMusic} label="Queue" hint="Up next" onClick={() => { onClose(); setQueueOpen(true); }} />
        <Row icon={FolderOpen} label="Import local files" hint="Play audio stored on this device" onClick={() => fileRef.current?.click()} />
        <input ref={fileRef} type="file" accept="audio/*" multiple hidden onChange={(e) => { if (e.target.files?.length) importLocal(e.target.files, notify).then(onClose); e.target.value = ""; }} />
      </div>
    </Sheet>
  );
}

/* ---------------- Sleep timer ---------------- */
function SleepSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sleep = usePlayer((s) => s.sleep);
  const setSleep = usePlayer((s) => s.setSleep);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [open]);
  const remaining = sleep.endsAt ? Math.max(0, sleep.endsAt - Date.now()) : 0;
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const options = [5, 10, 15, 30, 45, 60];
  return (
    <Sheet open={open} onClose={onClose} title="Sleep timer">
      {(sleep.endsAt || sleep.atTrackEnd) && (
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-brand/15 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{sleep.atTrackEnd ? "Stops at end of track" : `Music stops in ${mm}:${ss.toString().padStart(2, "0")}`}</p>
            <p className="text-xs text-muted">Playback will pause automatically</p>
          </div>
          <button onClick={() => setSleep(null)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">Turn off</button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {options.map((m) => (
          <button key={m} onClick={() => { setSleep(m); onClose(); }} className="rounded-2xl bg-white/8 py-3 text-sm font-semibold transition hover:bg-white/15">
            {m} min
          </button>
        ))}
        <button onClick={() => { setSleep(null, true); onClose(); }} className="col-span-3 rounded-2xl bg-white/8 py-3 text-sm font-semibold transition hover:bg-white/15">
          End of track
        </button>
      </div>
    </Sheet>
  );
}

/* ---------------- Equalizer ---------------- */
function EqSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const eq = usePlayer((s) => s.eq);
  const setEq = usePlayer((s) => s.setEq);
  const labels = ["60", "230", "910", "3.6k", "14k"];
  return (
    <Sheet open={open} onClose={onClose} title="Equalizer">
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-white/6 px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Enable equalizer</p>
          <p className="text-xs text-muted">Routes audio through Web Audio</p>
        </div>
        <Toggle on={eq.enabled} onChange={(v) => setEq({ enabled: v })} />
      </div>
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
        {Object.keys(EQ_PRESETS).map((p) => (
          <button
            key={p}
            onClick={() => setEq({ preset: p, gains: EQ_PRESETS[p], enabled: true })}
            className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition", eq.preset === p ? "bg-brand text-white" : "bg-white/10 hover:bg-white/15")}
          >
            {p}
          </button>
        ))}
      </div>
      <div className={cn("flex justify-between px-2 transition", !eq.enabled && "opacity-40")}>
        {EQ_BANDS.map((_, i) => {
          const g = eq.gains[i] ?? 0;
          return (
            <div key={i} className="flex flex-col items-center gap-2">
              <span className="text-xs tabular-nums text-muted">{g > 0 ? `+${g}` : g}</span>
              <input
                type="range"
                className="vertical"
                min={-12}
                max={12}
                step={1}
                value={g}
                disabled={!eq.enabled}
                onChange={(e) => {
                  const gains = [...eq.gains];
                  gains[i] = Number(e.target.value);
                  setEq({ gains, preset: "Custom" });
                }}
                style={{ ["--pct" as string]: `${((g + 12) / 24) * 100}%`, ["--fill" as string]: "#ff4f8b", ["--thumb" as string]: 1 }}
                aria-label={`${labels[i]} Hz`}
              />
              <span className="text-xs text-muted">{labels[i]}</span>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition", on ? "bg-brand" : "bg-white/15")}
    >
      <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition", on ? "left-[calc(100%-1.625rem)]" : "left-0.5")} />
    </button>
  );
}

/* ---------------- Audio output / stream info ---------------- */
type Sinkable = HTMLMediaElement & { setSinkId?: (id: string) => Promise<void>; sinkId?: string };
function AudioSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [current, setCurrent] = useState("");
  const [supported, setSupported] = useState(true);
  const track = usePlayer((s) => s.queue[s.index] ?? null);
  const downloaded = useLocal((s) => (track ? !!s.downloads[track.id] : false));
  useEffect(() => {
    if (!open) return;
    const el = audioElement.current as Sinkable | null;
    if (!el || typeof el.setSinkId !== "function" || !navigator.mediaDevices?.enumerateDevices) {
      setSupported(false);
      return;
    }
    setCurrent(el.sinkId ?? "");
    navigator.mediaDevices.enumerateDevices().then((list) => setDevices(list.filter((d) => d.kind === "audiooutput"))).catch(() => setSupported(false));
  }, [open]);
  const pick = async (id: string) => {
    const el = audioElement.current as Sinkable | null;
    if (!el?.setSinkId) return;
    try {
      await el.setSinkId(id);
      setCurrent(id);
    } catch {
      useLibrary.getState().notify("Couldn't switch output");
    }
  };
  const source = track?.id.startsWith("local:") ? "Local file" : downloaded ? "Downloaded copy" : "Online audio · AAC up to 128 kbps";
  return (
    <Sheet open={open} onClose={onClose} title="Audio">
      <div className="mb-4 rounded-2xl bg-white/6 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Audio track</p>
        <p className="mt-1 flex items-center gap-2 font-semibold"><Disc3 size={16} className="text-brand" /> {source}</p>
      </div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Output device</p>
      {!supported && <p className="rounded-2xl bg-white/6 p-4 text-sm text-muted">Output switching isn&apos;t available in this browser. Use your system&apos;s audio settings or Bluetooth menu.</p>}
      {supported && devices.length === 0 && <p className="rounded-2xl bg-white/6 p-4 text-sm text-muted">Allow microphone access once to list devices, or use system audio settings.</p>}
      <div className="space-y-1">
        {devices.map((d) => {
          const active = (current || "default") === (d.deviceId || "default");
          return (
            <button key={d.deviceId} onClick={() => pick(d.deviceId)} className="flex w-full items-center gap-3 rounded-2xl p-2 hover:bg-white/5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><Speaker size={18} /></span>
              <span className="flex-1 truncate text-left text-sm font-medium">{d.label || "Audio output"}</span>
              {active && <Check size={18} className="text-brand" />}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

/* ---------------- Group session (community) ---------------- */
function GroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const track = usePlayer((s) => s.queue[s.index] ?? null);
  const notify = useLibrary((s) => s.notify);
  const share = async () => {
    const url = `${window.location.origin}/search?q=${encodeURIComponent(track ? `${track.title} ${track.artist}` : "")}`;
    const data = { title: track ? `${track.title} — ${track.artist}` : "Beatly", text: "Listen with me on Beatly", url };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(url);
        notify("Link copied");
      }
    } catch {
      /* cancelled */
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Group session">
      <div className="rounded-3xl bg-gradient-to-br from-brand/30 to-purple-600/20 p-5">
        <Users size={28} className="text-brand" />
        <p className="mt-3 text-lg font-bold">Listen together</p>
        <p className="mt-1 text-sm text-white/70">Real-time collaborative queues are coming soon. For now, share what you&apos;re playing with friends.</p>
        <button onClick={share} className="mt-4 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-black">
          <Share2 size={16} /> Share {track ? "this track" : "Beatly"}
        </button>
      </div>
    </Sheet>
  );
}

/* ---------------- Region / language ---------------- */
function RegionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const regional = GENRES.filter((g) => ["african", "arabic", "bengali", "bollywood", "k-pop", "latin", "punjabi", "tamil"].includes(g.slug));
  return (
    <Sheet open={open} onClose={onClose} title="Regional music">
      <p className="mb-3 flex items-center gap-2 text-sm text-muted"><Globe size={16} /> Explore charts by language and region</p>
      <div className="grid grid-cols-2 gap-2">
        {regional.map((g) => (
          <Link key={g.slug} href={`/mood/${g.slug}`} onClick={onClose} className="rounded-2xl p-4 font-bold" style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}>
            <span className="mr-1">{g.emoji}</span> {g.label}
          </Link>
        ))}
      </div>
    </Sheet>
  );
}

/* ---------------- Track "more" menu ---------------- */
function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const track = usePlayer((s) => s.queue[s.index] ?? null);
  const { playNext, addToQueue, setExpanded } = usePlayer();
  const { toggleLike, likedIds, notify } = useLibrary();
  const { downloads, progress, download, removeDownload } = useLocal();
  if (!track) return <Sheet open={open} onClose={onClose} title="Options"><p className="text-sm text-muted">Nothing is playing.</p></Sheet>;
  const isLocal = track.id.startsWith("local:");
  const dl = downloads[track.id];
  const go = (href: string) => { onClose(); setExpanded(false); router.push(href); };
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="mb-4 flex items-center gap-3">
        <Artwork src={track.artwork} alt="" className="h-14 w-14 rounded-xl" />
        <div className="min-w-0">
          <p className="truncate font-bold">{track.title}</p>
          <p className="truncate text-sm text-muted">{track.artist}</p>
        </div>
      </div>
      <div className="space-y-0.5">
        {!isLocal && <Row icon={Heart} label={likedIds.has(track.id) ? "Remove from Liked" : "Add to Liked"} onClick={() => { toggleLike(track); onClose(); }} />}
        {!isLocal && <Row icon={Plus} label="Add to playlist" onClick={() => { onClose(); openAddToPlaylist(track); }} />}
        <Row icon={ListEnd} label="Play next" onClick={() => { playNext(track); notify("Playing next"); onClose(); }} />
        <Row icon={ListPlus} label="Add to queue" onClick={() => { addToQueue(track); notify("Added to queue"); onClose(); }} />
        {!isLocal && (dl ? (
          <Row icon={Trash2} label="Remove download" hint={formatBytes(dl.size)} onClick={() => { removeDownload(track.id); onClose(); }} />
        ) : (
          <Row icon={Download} label={progress[track.id] !== undefined ? `Downloading… ${Math.round((progress[track.id] ?? 0) * 100)}%` : "Download"} hint="Listen offline" onClick={() => { download(track, notify); onClose(); }} />
        ))}
        {track.artistId && <Row icon={Mic2} label="Go to artist" hint={track.artist} onClick={() => go(`/artist/${track.artistId}`)} />}
        {track.albumId && <Row icon={Disc3} label="Go to album" hint={track.album ?? undefined} onClick={() => go(`/collection/${track.albumId}`)} />}
        <Row icon={Link2} label="Share" onClick={async () => {
          const url = `${window.location.origin}/search?q=${encodeURIComponent(`${track.title} ${track.artist}`)}`;
          try { if (navigator.share) await navigator.share({ title: track.title, url }); else { await navigator.clipboard.writeText(url); notify("Link copied"); } } catch { /* cancelled */ }
          onClose();
        }} />
        <Row icon={Sparkles} label="Recognize music nearby" href="/recognize" onClick={() => { onClose(); setExpanded(false); }} />
      </div>
    </Sheet>
  );
}
