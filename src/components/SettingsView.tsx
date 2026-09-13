"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Timer, SlidersHorizontal, Trash2, LogOut, LogIn, Palette, Captions, Waves, Database, ChevronRight, Sparkles, Check, Droplets } from "lucide-react";
import { useLocal, ACCENT_PRESETS, DEFAULT_ACCENT } from "@/store/local";
import { usePlayer } from "@/store/player";
import { useLibrary } from "@/store/library";
import { clearBlobs, formatBytes } from "@/lib/blobs";
import { PageHeader } from "@/components/Cards";
import { Toggle } from "@/components/Sheets";
import { cn } from "@/lib/utils";

export function SettingsView() {
  const router = useRouter();
  const { settings, setSettings, downloads, local, clearHistory } = useLocal();
  const { eq, sleep, openSheet } = usePlayer();
  const { user, notify, setUser } = useLibrary();
  const [customColor, setCustomColor] = useState(settings.accentColor);
  const storage = Object.values(downloads).reduce((a, d) => a + d.size, 0) + Object.values(local).reduce((a, l) => a + l.size, 0);

  const applyPreset = (color: string) => {
    setSettings({ accentColor: color });
    setCustomColor(color);
  };
  const applyCustom = (hex: string) => {
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      setSettings({ accentColor: hex });
      setCustomColor(hex);
    }
  };

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    useLibrary.setState({ likedIds: new Set(), playlists: [] });
    notify("Signed out");
    router.push("/");
    router.refresh();
  }

  async function clearOffline() {
    if (!confirm("Remove all downloads and imported local files from this device?")) return;
    await clearBlobs();
    useLocal.setState({ downloads: {}, local: {} });
    notify("Offline storage cleared");
  }

  return (
    <div className="pb-6">
      <PageHeader title="Settings" />
      <div className="space-y-6 px-4 md:px-6">
        <section className="glass rounded-3xl p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-lg font-bold">{user ? user.name.charAt(0).toUpperCase() : <Sparkles size={20} />}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{user ? user.name : "Guest"}</p>
              <p className="truncate text-xs text-muted">{user ? user.email : "Sign in to sync likes and playlists"}</p>
            </div>
            {user ? (
              <button onClick={logout} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold"><LogOut size={14} /> Sign out</button>
            ) : (
              <Link href="/login" className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black"><LogIn size={14} /> Log in</Link>
            )}
          </div>
        </section>

        <Group title="Appearance">
          <div className="p-3">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><Droplets size={18} /></span>
              <div className="flex-1">
                <p className="text-sm font-semibold">Accent color</p>
                <p className="text-xs text-muted">Playback controls, seek bar & highlights</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {ACCENT_PRESETS.map((p) => {
                const active = settings.accentColor.toLowerCase() === p.color.toLowerCase();
                return (
                  <button
                    key={p.key}
                    onClick={() => applyPreset(p.color)}
                    className={cn(
                      "relative h-10 w-10 rounded-full transition active:scale-95",
                      active && "ring-2 ring-white ring-offset-2 ring-offset-black",
                    )}
                    style={{ backgroundColor: p.color }}
                    aria-label={`Set accent to ${p.label}`}
                    title={p.label}
                  >
                    {active && (
                      <Check size={18} className="absolute inset-0 m-auto text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                    )}
                  </button>
                );
              })}
              <label
                className={cn(
                  "relative flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-white/20 px-3 text-xs font-bold transition hover:border-white/50",
                  ACCENT_PRESETS.some((p) => p.color.toLowerCase() === customColor.toLowerCase()) ? "text-white/70" : "ring-2 ring-white ring-offset-2 ring-offset-black text-white",
                )}
                style={{ borderColor: ACCENT_PRESETS.some((p) => p.color.toLowerCase() === customColor.toLowerCase()) ? undefined : customColor }}
                title="Custom color"
              >
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => applyCustom(e.target.value)}
                  className="absolute h-full w-full cursor-pointer opacity-0"
                  aria-label="Pick a custom accent color"
                />
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/30" style={{ backgroundColor: customColor }}>
                  <Sparkles size={12} />
                </span>
                Custom
              </label>
            </div>
            {ACCENT_PRESETS.some((p) => p.color.toLowerCase() === customColor.toLowerCase()) && (
              <p className="mt-3 text-xs text-muted">
                Currently: <span className="font-semibold text-white">{ACCENT_PRESETS.find((p) => p.color.toLowerCase() === customColor.toLowerCase())?.label}</span>
              </p>
            )}
          </div>
          <Row icon={Palette} label="Dynamic theme" hint="Tint the player with album-art colours" right={<Toggle on={settings.dynamicTheme} onChange={(v) => setSettings({ dynamicTheme: v })} />} />
          <Row icon={Captions} label="Open lyrics automatically" hint="Show synced lyrics when expanding the player" right={<Toggle on={settings.autoLyrics} onChange={(v) => setSettings({ autoLyrics: v })} />} />
        </Group>

        <Group title="Playback">
          <div className="p-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><Waves size={18} /></span>
              <div className="flex-1"><p className="text-sm font-semibold">Crossfade</p><p className="text-xs text-muted">Fade between tracks · {settings.fade ? `${settings.fade}s` : "Off"}</p></div>
            </div>
            <input type="range" min={0} max={12} step={1} value={settings.fade} onChange={(e) => setSettings({ fade: Number(e.target.value) })} className="mt-3 w-full" style={{ ["--pct" as string]: `${(settings.fade / 12) * 100}%`, ["--fill" as string]: settings.accentColor, ["--thumb" as string]: 1 }} aria-label="Crossfade" />
          </div>
          <Row icon={SlidersHorizontal} label="Equalizer" hint={eq.enabled ? `On · ${eq.preset}` : "Off"} onClick={() => openSheet("eq")} chevron />
          <Row icon={Timer} label="Sleep timer" hint={sleep.endsAt || sleep.atTrackEnd ? "Active" : "Off"} onClick={() => openSheet("sleep")} chevron />
          <Row icon={Database} label="Data saver" hint="Skip pre-loading the next track" right={<Toggle on={settings.dataSaver} onChange={(v) => setSettings({ dataSaver: v })} />} />
        </Group>

        <Group title="Storage">
          <Row icon={Database} label="Offline storage" hint={`${formatBytes(storage)} used by downloads and local files`} />
          <Row icon={Trash2} label="Clear offline files" hint="Remove downloads and imported files" onClick={clearOffline} danger />
          <Row icon={Trash2} label="Clear listening history" hint="Resets stats and My top 50" onClick={() => { clearHistory(); notify("History cleared"); }} danger />
        </Group>

        <Group title="About">
          <Row icon={Sparkles} label="Beatly" hint="Lightweight · private · ad-free. Music discovery, synced lyrics and offline playback." />
        </Group>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">{title}</p>
      <div className="divide-y divide-white/5 rounded-3xl bg-white/5">{children}</div>
    </section>
  );
}

function Row({ icon: Icon, label, hint, right, onClick, chevron, danger }: { icon: typeof Timer; label: string; hint?: string; right?: React.ReactNode; onClick?: () => void; chevron?: boolean; danger?: boolean }) {
  const content = (
    <>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ${danger ? "text-red-400" : ""}`}><Icon size={18} /></span>
      <span className="min-w-0 flex-1 text-left">
        <span className={`block text-sm font-semibold ${danger ? "text-red-400" : ""}`}>{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      {right}
      {chevron && <ChevronRight size={18} className="text-muted" />}
    </>
  );
  return onClick ? (
    <button onClick={onClick} className="flex w-full items-center gap-3 p-3 text-left hover:bg-white/5">{content}</button>
  ) : (
    <div className="flex items-center gap-3 p-3">{content}</div>
  );
}
