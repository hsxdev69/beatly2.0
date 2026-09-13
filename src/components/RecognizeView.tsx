"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, History, AudioLines, Search, X } from "lucide-react";
import { useLocal } from "@/store/local";
import { Sheet } from "@/components/Sheet";
import { cn } from "@/lib/utils";

type Phase = "idle" | "listening" | "matching" | "found" | "nomatch" | "unconfigured" | "denied";
type Match = { title: string; artist: string; album?: string };

const LISTEN_MS = 9000;
const TOKEN = process.env.NEXT_PUBLIC_AUDD_API_TOKEN;

export function RecognizeView() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [match, setMatch] = useState<Match | null>(null);
  const [level, setLevel] = useState(0);
  const [histOpen, setHistOpen] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const rafRef = useRef(0);
  const { recognitions, addRecognition } = useLocal();

  useEffect(() => () => stop(), []);

  function stop() {
    cancelAnimationFrame(rafRef.current);
    const r = recRef.current;
    if (r && r.state !== "inactive") r.stop();
    r?.stream.getTracks().forEach((t) => t.stop());
    recRef.current = null;
  }

  async function start() {
    if (phase === "listening") return stop();
    setMatch(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setPhase("denied");
    }
    setPhase("listening");
    // Level meter for the pulsing button
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser();
        an.fftSize = 256;
        src.connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        const tick = () => {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += (v - 128) ** 2;
          setLevel(Math.min(1, Math.sqrt(sum / buf.length) / 40));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
        stream.addEventListener("inactive", () => ctx.close().catch(() => {}), { once: true });
      }
    } catch {
      /* meter optional */
    }
    const chunks: BlobPart[] = [];
    const rec = new MediaRecorder(stream);
    recRef.current = rec;
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      cancelAnimationFrame(rafRef.current);
      setLevel(0);
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (!TOKEN) {
        setPhase("unconfigured");
        addRecognition({ at: Date.now(), ok: false });
        return;
      }
      setPhase("matching");
      try {
        const fd = new FormData();
        fd.append("api_token", TOKEN);
        fd.append("file", blob, "sample.webm");
        fd.append("return", "apple_music,spotify");
        const res = await fetch("https://api.audd.io/", { method: "POST", body: fd });
        const j = (await res.json()) as { status: string; result: { title: string; artist: string; album?: string } | null };
        if (j.status === "success" && j.result) {
          const m = { title: j.result.title, artist: j.result.artist, album: j.result.album };
          setMatch(m);
          setPhase("found");
          addRecognition({ at: Date.now(), ok: true, ...m });
        } else {
          setPhase("nomatch");
          addRecognition({ at: Date.now(), ok: false });
        }
      } catch {
        setPhase("nomatch");
      }
    };
    rec.start();
    setTimeout(() => rec.state !== "inactive" && rec.stop(), LISTEN_MS);
  }

  const busy = phase === "listening" || phase === "matching";
  const helper =
    phase === "idle" ? "Tap to recognize" :
    phase === "listening" ? "Listening…" :
    phase === "matching" ? "Matching…" :
    phase === "found" ? "Found it!" :
    phase === "nomatch" ? "No match — try again closer to the speaker" :
    phase === "denied" ? "Microphone access is needed to recognize music" :
    "Recognition service not configured";

  return (
    <div className="flex min-h-dvh flex-col bg-black">
      <div className="flex items-center justify-between px-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button onClick={() => router.back()} className="rounded-full p-2 hover:bg-white/10" aria-label="Back"><ChevronLeft size={26} /></button>
        <p className="text-sm font-bold">Recognize Music</p>
        <button onClick={() => setHistOpen(true)} className="rounded-full p-2 hover:bg-white/10" aria-label="History"><History size={22} /></button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="relative flex h-64 w-64 items-center justify-center">
          {busy && (
            <>
              <span className="pulse-ring absolute inset-8 rounded-full border border-brand/70" />
              <span className="pulse-ring absolute inset-8 rounded-full border border-brand/50" />
              <span className="pulse-ring absolute inset-8 rounded-full border border-brand/30" />
            </>
          )}
          <span className="absolute inset-10 rounded-full bg-brand/20 blur-2xl transition-transform" style={{ transform: `scale(${1 + level * 0.8})` }} />
          <button
            onClick={start}
            disabled={phase === "matching"}
            className={cn(
              "relative flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-brand to-pink-700 text-white shadow-2xl shadow-brand/40 transition active:scale-95",
              phase === "listening" && "animate-float",
            )}
            style={{ transform: `scale(${1 + level * 0.12})` }}
            aria-label="Recognize"
          >
            <AudioLines size={64} strokeWidth={1.75} />
          </button>
        </div>
        <p className="mt-6 text-lg font-semibold">{helper}</p>
        {phase === "unconfigured" && (
          <p className="mt-2 max-w-sm text-sm text-muted">
            Add an audio-fingerprinting key as <code className="rounded bg-white/10 px-1">NEXT_PUBLIC_AUDD_API_TOKEN</code> to enable identification. You can still search by lyrics or title below.
          </p>
        )}
        {phase === "found" && match && (
          <div className="glass mt-6 w-full max-w-sm rounded-3xl p-5 text-left">
            <p className="text-xl font-extrabold">{match.title}</p>
            <p className="text-sm text-muted">{match.artist}{match.album ? ` · ${match.album}` : ""}</p>
            <Link href={`/search?q=${encodeURIComponent(`${match.title} ${match.artist}`)}`} className="mt-4 flex items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-bold text-black">
              <Search size={16} /> Play on Beatly
            </Link>
          </div>
        )}
        {(phase === "nomatch" || phase === "unconfigured") && (
          <Link href="/search" className="glass mt-4 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold hover:bg-white/15">
            <Search size={16} /> Search manually
          </Link>
        )}
      </div>

      <Sheet open={histOpen} onClose={() => setHistOpen(false)} title="Recognition history">
        {recognitions.length === 0 && <p className="text-sm text-muted">No recognitions yet.</p>}
        <div className="space-y-1">
          {recognitions.map((r, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl p-2">
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", r.ok ? "bg-brand/20 text-brand" : "bg-white/10 text-muted")}>{r.ok ? <AudioLines size={18} /> : <X size={18} />}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.ok ? r.title : "No match"}</p>
                <p className="truncate text-xs text-muted">{r.ok ? r.artist : new Date(r.at).toLocaleString()}</p>
              </div>
              {r.ok && <Link href={`/search?q=${encodeURIComponent(`${r.title} ${r.artist}`)}`} onClick={() => setHistOpen(false)} className="text-xs font-bold text-brand">Play</Link>}
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
