
/**
 * ┌──────────────────────────┐
 * │ Audio Stream Resolver    │   Layer 2 — Song ID → Stream URL
 * └──────────────────────────┘
 *
 * Resolves a YouTube video id to a direct, audio-only stream URL:
 *
 *   1. An InnerTube session (youtubei.js) is created with a session-bound
 *      Proof-of-Origin token minted by the BotGuard worker (src/lib/pot.ts).
 *   2. Player API calls are SERIALIZED with a minimum gap between them.
 *      YouTube rate-limits datacenter IPs: a burst of rapid player requests
 *      returns LOGIN_REQUIRED ("Sign in to confirm you're not a bot") while
 *      spaced-out requests succeed. Only ONE client is attempted per track
 *      when flagged — every client fails identically then, so looping just
 *      deepens the flag. A circuit breaker skips InnerTube entirely for a
 *      cooldown after consecutive LOGIN_REQUIRED failures.
 *   3. Clients are tried in order (YTMUSIC → MWEB → IOS → ANDROID → WEB) for
 *      NON-login errors only. SABR-only formats (no URL and no cipher) are
 *      skipped — they can't be proxied as a plain file. mp4/AAC is preferred
 *      for Safari/Android compat.
 *   4. A video-bound PO token is attached (`pot=`) best-effort — that is what
 *      makes the CDN serve the full file with arbitrary HTTP ranges.
 *   5. If InnerTube fails, the Piped proxy backend is tried (their servers do
 *      the player work, so our IP flag doesn't matter). If that also fails,
 *      the client falls back to the hidden YouTube iframe player.
 *
 * Resolved URLs are IP-locked to this server and expire after a few hours, so
 * they are cached briefly here and proxied to the browser by /api/stream/[id].
 */
import "server-only";
import { Innertube, Platform } from "youtubei.js";
import { mintPoToken, YT_USER_AGENT } from "@/lib/pot";

// youtubei.js needs a JS evaluator to run YouTube's (de)cipher routines.
Platform.shim.eval = async (data: { output: string }) => new Function(data.output)();

export type ResolvedStream = {
  url: string;
  mimeType: string;
  contentLength: number | null;
  bitrate: number | null;
  durationMs: number | null;
  client: string;
  expiresAt: number;
  /** Which backend produced this URL (for diagnostics / x-beatly-resolver). */
  backend: "innertube" | "piped" | "invidious" | "custom";
};

type BasicInfo = Awaited<ReturnType<Innertube["getBasicInfo"]>>;

// Structural view of adaptive formats — avoids depending on youtubei.js
// internal class exports while keeping full type safety at runtime.
type AdaptiveFormat = {
  url?: string | null;
  signature_cipher?: string | null;
  cipher?: string | null;
  mime_type?: string;
  bitrate?: number | null;
  content_length?: number | null;
  approx_duration_ms?: number | null;
  has_audio?: boolean;
  has_video?: boolean;
  decipher: (player: unknown) => Promise<string>;
};

const CLIENTS = ["YTMUSIC", "MWEB", "IOS", "ANDROID", "WEB"] as const;
type ClientName = (typeof CLIENTS)[number];

const DEFAULT_TTL = 60 * 60 * 1000;
const SAFETY_MARGIN = 10 * 60 * 1000;
const SESSION_TTL = 6 * 60 * 60 * 1000;
// Minimum spacing between InnerTube PLAYER calls. Bursts trip bot detection.
const PLAYER_MIN_GAP_MS = 1000;

type Session = { yt: Innertube; createdAt: number };

const g = globalThis as typeof globalThis & {
  __beatlySession?: Promise<Session> | null;
  __beatlyStreamCache?: Map<string, ResolvedStream>;
  __beatlyStreamFail?: Map<string, number>;
  __beatlyInflight?: Map<string, Promise<ResolvedStream>>;
  __beatlyPlayerQueue?: Promise<void>;
  __beatlyLastPlayerCall?: number;
  __beatlyItFails?: number;
  __beatlyItSkipUntil?: number;
};
// After N consecutive InnerTube LOGIN_REQUIRED failures, skip InnerTube for a
// cooldown so we stop hammering a flagged IP and go straight to Piped.
const IT_BREAKER_THRESHOLD = 2;
const IT_BREAKER_COOLDOWN_MS = 10 * 60 * 1000;
const cache = (g.__beatlyStreamCache ??= new Map());
// Short negative cache: while an id is cooling down we do NOT hit YouTube
// again (retry storms deepen the bot flag that breaks background playback).
const failUntil = (g.__beatlyStreamFail ??= new Map());
// Short cooldown after a failed resolve so a retry storm can't deepen the bot
// flag, but not so long that a user is locked out. `?fresh=1` bypasses it.
const FAIL_COOLDOWN_MS = 8_000;
const inflight = (g.__beatlyInflight ??= new Map());
if (!g.__beatlyPlayerQueue) g.__beatlyPlayerQueue = Promise.resolve();
if (!g.__beatlyLastPlayerCall) g.__beatlyLastPlayerCall = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Serialize ALL InnerTube player requests process-wide with a minimum gap.
 * Concurrent /api/stream hits otherwise burst the player endpoint and get
 * LOGIN_REQUIRED for every client.
 */
async function throttledPlayerCall<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void = () => {};
  const prev = g.__beatlyPlayerQueue ?? Promise.resolve();
  g.__beatlyPlayerQueue = new Promise<void>((r) => {
    release = r;
  });
  await prev;
  try {
    const wait = PLAYER_MIN_GAP_MS - (Date.now() - (g.__beatlyLastPlayerCall ?? 0));
    if (wait > 0) await sleep(wait);
    return await fn();
  } finally {
    g.__beatlyLastPlayerCall = Date.now();
    release();
  }
}

async function createSession(): Promise<Session> {
  // Bootstrap session → visitor data → session-bound PO token → real session.
  const boot = await Innertube.create({
    retrieve_player: false,
    generate_session_locally: true,
    user_agent: YT_USER_AGENT,
  });
  const visitorData = boot.session.context.client.visitorData;
  if (!visitorData) throw new Error("No visitor data");

  let poToken: string | undefined;
  try {
    poToken = (await mintPoToken(visitorData)) ?? undefined;
  } catch (err) {
    console.warn("Session PO token mint failed, continuing without:", err);
  }

  const yt = await Innertube.create({
    po_token: poToken,
    visitor_data: visitorData,
    retrieve_player: true,
    generate_session_locally: true,
    user_agent: YT_USER_AGENT,
  });
  return { yt, createdAt: Date.now() };
}

async function getSession(): Promise<Session> {
  const existing = g.__beatlySession ? await g.__beatlySession.catch(() => null) : null;
  if (existing && Date.now() - existing.createdAt < SESSION_TTL) return existing;
  g.__beatlySession = createSession().catch((e) => {
    g.__beatlySession = null;
    throw e;
  });
  return g.__beatlySession;
}

function expiryFromUrl(url: string): number {
  try {
    const expire = Number(new URL(url).searchParams.get("expire"));
    if (expire > 0) return expire * 1000 - SAFETY_MARGIN;
  } catch {
    /* ignore */
  }
  return Date.now() + DEFAULT_TTL;
}

async function getPlayerInfo(yt: Innertube, videoId: string, client: ClientName): Promise<BasicInfo> {
  // Single attempt only. Evidence shows that once the IP is flagged, every
  // immediate retry / extra client also returns LOGIN_REQUIRED — retries just
  // burn quota and deepen the flag. Fall through to Piped instead.
  return throttledPlayerCall(() => yt.getBasicInfo(videoId, { client }));
}

/** Best audio-only format that can actually be proxied (direct URL or decipherable cipher). */
function pickAudioFormat(info: BasicInfo): AdaptiveFormat | null {
  const ads = (info.streaming_data?.adaptive_formats ?? []) as unknown as AdaptiveFormat[];
  const audio = ads.filter((f) => f.has_audio && !f.has_video && (f.url || f.signature_cipher || f.cipher));
  if (!audio.length) return null;
  const mp4 = audio.filter((f) => f.mime_type?.includes("mp4"));
  const pool = mp4.length ? mp4 : audio;
  pool.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  return pool[0];
}

async function resolveWithClient(yt: Innertube, videoId: string, client: ClientName): Promise<ResolvedStream> {
  const info = await getPlayerInfo(yt, videoId, client);
  const status = info.playability_status?.status;
  if (status && status !== "OK") {
    throw new Error(`${client}: ${status} ${info.playability_status?.reason ?? ""}`.trim());
  }

  const format = pickAudioFormat(info);
  if (!format) {
    throw new Error(`${client}: no downloadable audio format (SABR-only)`);
  }

  let deciphered: string | undefined;
  try {
    deciphered = await format.decipher(yt.session.player);
  } catch {
    deciphered = format.url ?? undefined;
  }

  if (typeof deciphered !== "string" || !deciphered.startsWith("http")) {
    throw new Error(`${client}: no stream url`);
  }

  const url = new URL(deciphered);
  try {
    const pot = await mintPoToken(videoId);
    if (pot) url.searchParams.set("pot", pot);
  } catch {
    /* continue with base url */
  }

  let probe: Response;
  try {
    probe = await fetch(url, {
      headers: { range: "bytes=0-1", "user-agent": YT_USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    throw new Error(`${client}: probe failed (${e instanceof Error ? e.message : String(e)})`);
  }
  probe.body?.cancel().catch(() => {});
  if (probe.status !== 206 && probe.status !== 200) {
    throw new Error(`${client}: probe ${probe.status}`);
  }

  return {
    url: url.toString(),
    mimeType: format.mime_type?.split(";")[0] ?? "audio/mp4",
    contentLength: format.content_length ?? null,
    bitrate: format.bitrate ?? null,
    durationMs: format.approx_duration_ms ?? null,
    client,
    backend: "innertube",
    expiresAt: expiryFromUrl(url.toString()),
  };
}

/* ------------------------------------------------------------------ */
/* Fallback backend: Piped proxy (their servers do the player work, so  */
/* our datacenter IP flag doesn't matter). Audio-only formats are       */
/* preferred; otherwise a progressive mp4 (itag 18/22) carries audio.   */
/* ------------------------------------------------------------------ */

/** Parse a comma-separated env var into a clean list of base URLs. */
function envList(name: string): string[] {
  return (
    process.env[name]
      ?.split(",")
      .map((s) => s.trim().replace(/\/+$/, ""))
      .filter(Boolean) ?? []
  );
}

const PUBLIC_PIPED = [
  "https://pipedapi.kavin.rocks",
  "https://api.piped.private.coffee",
  "https://pipedapi.ducks.party",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.drgns.space",
  "https://pipedapi.reallyaweso.me",
  "https://pipedapi.leptons.xyz",
];

const PUBLIC_INVIDIOUS = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://iv.melmac.space",
  "https://invidious.jing.rocks",
  "https://yewtu.be",
];

/**
 * Piped instances. Self-hosted instances via `PIPED_API_URL` (comma-separated)
 * are tried FIRST — that is the only reliable fix for datacenter-IP blocking on
 * Vercel. Public mirrors are best-effort (they frequently 403/500 datacenter
 * IPs). Read per-call so env changes take effect without a rebuild.
 */
function pipedInstances(): string[] {
  return [...envList("PIPED_API_URL"), ...PUBLIC_PIPED];
}

/**
 * Invidious `latest_version` proxy — an independent fallback that streams audio
 * through Invidious's own servers (their IP, not ours), bypassing the datacenter
 * block. `INVIDIOUS_API_URL` (comma-separated) self-hosted instances are tried
 * first. itag 140 = m4a audio, 251/250/249 = opus/webm audio.
 */
function invidiousInstances(): string[] {
  return [...envList("INVIDIOUS_API_URL"), ...PUBLIC_INVIDIOUS];
}
const INVIDIOUS_AUDIO_ITAGS = [140, 251, 250, 249];

type PipedStreamItem = {
  itag?: number;
  mimeType?: string;
  codec?: string;
  bitrate?: number;
  url?: string;
  quality?: string;
};

// Progressive itags that contain an audio track, in preference order.
const PROGRESSIVE_PREF = [18, 22, 43, 36, 17];

async function resolveViaPiped(videoId: string): Promise<ResolvedStream> {
  const errors: string[] = [];
  for (const base of pipedInstances()) {
    try {
      const res = await fetch(`${base}/streams/${videoId}`, {
        headers: { accept: "application/json", "user-agent": YT_USER_AGENT },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const data = (await res.json()) as {
        audioStreams?: PipedStreamItem[];
        videoStreams?: PipedStreamItem[];
        duration?: number;
      };
      if ((data as { error?: string }).error) throw new Error("instance error");

      const audio = (data.audioStreams ?? []).filter((s) => s.url);
      const mp4Audio = audio.filter((s) => s.mimeType?.includes("mp4"));
      const pool = mp4Audio.length ? mp4Audio : audio;
      pool.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
      let chosen: PipedStreamItem | undefined = pool[0];

      if (!chosen) {
        // No audio-only formats — fall back to progressive mp4 with audio.
        const vids = (data.videoStreams ?? []).filter(
          (s) => s.url && s.mimeType?.includes("mp4") && typeof s.itag === "number",
        );
        vids.sort(
          (a, b) => PROGRESSIVE_PREF.indexOf(a.itag ?? 999) - PROGRESSIVE_PREF.indexOf(b.itag ?? 999),
        );
        chosen = vids.find((s) => PROGRESSIVE_PREF.includes(s.itag ?? -1));
      }
      if (!chosen?.url) throw new Error("no playable streams");

      const probe = await fetch(chosen.url, {
        headers: { range: "bytes=0-1" },
        signal: AbortSignal.timeout(10000),
      });
      probe.body?.cancel().catch(() => {});
      if (probe.status !== 206 && probe.status !== 200) {
        throw new Error(`probe ${probe.status}`);
      }
      const lenHeader = probe.headers.get("content-range")?.split("/")[1] ?? probe.headers.get("content-length");

      return {
        url: chosen.url,
        mimeType: chosen.mimeType?.split(";")[0] ?? "audio/mp4",
        contentLength: lenHeader ? Number(lenHeader) || null : null,
        bitrate: chosen.bitrate ?? null,
        durationMs: typeof data.duration === "number" ? data.duration * 1000 : null,
        client: `PIPED(itag${chosen.itag ?? "?"})`,
        backend: "piped",
        expiresAt: Date.now() + 30 * 60 * 1000,
      };
    } catch (e) {
      errors.push(`${base}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 120));
    }
  }
  throw new Error(`Piped failed: ${errors.join(" | ") || "no instances"}`);
}

/**
 * Invidious fallback. Uses `latest_version?id=…&itag=…&local=true` which streams
 * the audio through the Invidious instance itself, so YouTube never sees our
 * datacenter IP. We validate the probe actually returns audio bytes (not an
 * HTML captcha / error page), then hand the proxied URL to the browser.
 */
async function resolveViaInvidious(videoId: string): Promise<ResolvedStream> {
  const errors: string[] = [];
  for (const base of invidiousInstances()) {
    for (const itag of INVIDIOUS_AUDIO_ITAGS) {
      const url = `${base}/latest_version?id=${encodeURIComponent(videoId)}&itag=${itag}&local=true`;
      try {
        const probe = await fetch(url, {
          headers: { range: "bytes=0-1", "user-agent": YT_USER_AGENT, accept: "*/*" },
          redirect: "follow",
          signal: AbortSignal.timeout(10000),
        });
        const ctype = probe.headers.get("content-type") ?? "";
        // Anti-bot pages / errors come back as HTML — reject them.
        if (!probe.ok && probe.status !== 206) {
          probe.body?.cancel().catch(() => {});
          throw new Error(`itag${itag} status ${probe.status}`);
        }
        if (ctype.includes("text/html") || ctype.includes("application/json")) {
          probe.body?.cancel().catch(() => {});
          throw new Error(`itag${itag} not audio (${ctype.split(";")[0]})`);
        }
        const lenHeader =
          probe.headers.get("content-range")?.split("/")[1] ?? probe.headers.get("content-length");
        probe.body?.cancel().catch(() => {});

        const mime = ctype.split(";")[0] || (itag === 140 ? "audio/mp4" : "audio/webm");
        return {
          url,
          mimeType: mime,
          contentLength: lenHeader ? Number(lenHeader) || null : null,
          bitrate: null,
          durationMs: null,
          client: `INVIDIOUS(itag${itag})`,
          backend: "invidious",
          expiresAt: Date.now() + 30 * 60 * 1000,
        };
      } catch (e) {
        errors.push(`${base.replace(/^https?:\/\//, "")}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 100));
      }
    }
  }
  throw new Error(`Invidious failed: ${errors.slice(0, 4).join(" | ") || "no instances"}`);
}

/** Try Piped, then Invidious — the two IP-independent proxy backends. */
async function resolveViaProxy(videoId: string): Promise<ResolvedStream> {
  try {
    return await resolveViaPiped(videoId);
  } catch (pipedErr) {
    try {
      return await resolveViaInvidious(videoId);
    } catch (invErr) {
      throw new Error(
        `${pipedErr instanceof Error ? pipedErr.message : String(pipedErr)} || ${
          invErr instanceof Error ? invErr.message : String(invErr)
        }`.slice(0, 500),
      );
    }
  }
}

async function resolveViaInnerTube(videoId: string): Promise<ResolvedStream> {
  const { yt } = await getSession();
  const errors: string[] = [];
  for (const client of CLIENTS) {
    try {
      const res = await resolveWithClient(yt, videoId, client);
      g.__beatlyItFails = 0;
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
      // When the IP is flagged, EVERY client returns LOGIN_REQUIRED — trying
      // the rest only burns quota and extends the flag. Fail fast to Piped.
      if (msg.includes("LOGIN_REQUIRED")) break;
    }
  }
  // Everything failed — session/visitor data may be burned; rebuild next call.
  g.__beatlySession = null;
  throw new Error(`InnerTube: ${errors.join(" | ")}`);
}

async function resolveUncached(videoId: string): Promise<ResolvedStream> {
  const skipInnerTube = (g.__beatlyItSkipUntil ?? 0) > Date.now();

  if (!skipInnerTube) {
    try {
      return await resolveViaInnerTube(videoId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`InnerTube resolve failed for ${videoId}, trying Piped:`, msg.slice(0, 200));
      if (msg.includes("LOGIN_REQUIRED")) {
        const fails = (g.__beatlyItFails ?? 0) + 1;
        g.__beatlyItFails = fails;
        if (fails >= IT_BREAKER_THRESHOLD) {
          g.__beatlyItSkipUntil = Date.now() + IT_BREAKER_COOLDOWN_MS;
          console.warn(`InnerTube circuit open for ${IT_BREAKER_COOLDOWN_MS / 60000} min`);
        }
      }
      try {
        return await resolveViaProxy(videoId);
      } catch (proxyErr) {
        throw new Error(
          `Unable to resolve ${videoId}: ${msg.slice(0, 200)} || ${proxyErr instanceof Error ? proxyErr.message : String(proxyErr)}`.slice(0, 600),
        );
      }
    }
  }

  // Circuit open — go straight to the proxy backends (Piped → Invidious).
  try {
    return await resolveViaProxy(videoId);
  } catch (e) {
    throw new Error(
      `Unable to resolve ${videoId} (InnerTube cooling down): ${e instanceof Error ? e.message : String(e)}`.slice(0, 500),
    );
  }
}

export function invalidateStream(videoId: string) {
  cache.delete(videoId);
  // ?fresh=1 from the <audio> element bypasses the failure cooldown.
  failUntil.delete(videoId);
}

export async function resolveStream(videoId: string): Promise<ResolvedStream> {
  const hit = cache.get(videoId);
  if (hit && hit.expiresAt > Date.now()) return hit;
  cache.delete(videoId);

  // Failure cooldown: a burst of retries is what deepens YouTube's bot flag
  // (and thereby breaks background playback). While cooling down, fail fast.
  const coolUntil = failUntil.get(videoId) ?? 0;
  if (coolUntil > Date.now()) {
    throw new Error(`resolve cooling down (${Math.ceil((coolUntil - Date.now()) / 1000)}s) for ${videoId}`);
  }

  const pending = inflight.get(videoId);
  if (pending) return pending;

  const p = resolveUncached(videoId)
    .then((res) => {
      failUntil.delete(videoId);
      cache.set(videoId, res);
      if (cache.size > 500) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      return res;
    })
    .catch((e) => {
      failUntil.set(videoId, Date.now() + FAIL_COOLDOWN_MS);
      console.warn(`[StreamResolver] ${videoId} failed — cooling down ${FAIL_COOLDOWN_MS / 1000}s:`, String(e).slice(0, 160));
      throw e;
    })
    .finally(() => inflight.delete(videoId));
  inflight.set(videoId, p);
  return p;
}
