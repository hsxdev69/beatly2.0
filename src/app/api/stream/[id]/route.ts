/**
 * /api/stream/[id] — the HTTP face of the Audio Stream Resolver.
 *
 * The browser's <audio> element points here. We resolve the video id to an
 * upstream audio URL and proxy the bytes, forwarding Range requests so the
 * player can seek and buffer exactly like a normal media file.
 */
import { NextResponse } from "next/server";
import { invalidateStream, resolveStream } from "@/lib/resolver";
import { YT_USER_AGENT } from "@/lib/pot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Stream resolution can require BotGuard/PO-token startup on a cold Vercel
// function. Give the Node serverless function enough time for that cold path.
export const maxDuration = 60;

const ID_RE = /^[A-Za-z0-9_-]{6,20}$/;
const PASS = ["content-type", "content-length", "content-range", "last-modified", "etag"];
const UA = YT_USER_AGENT;

type Ctx = { params: Promise<{ id: string }> };

function setCors(headers: Headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Range, User-Agent, Accept");
  headers.set("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
}

export async function OPTIONS() {
  const headers = new Headers();
  setCors(headers);
  return new Response(null, { status: 204, headers });
}

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) {
    const res = NextResponse.json({ error: "Invalid id" }, { status: 400 });
    setCors(res.headers);
    return res;
  }

  const clientRange = req.headers.get("range");
  const range = clientRange ?? "bytes=0-";
  if (new URL(req.url).searchParams.has("fresh")) invalidateStream(id);

  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    // If client already aborted, stop immediately without erroring upstream
    if (req.signal?.aborted) {
      return new Response(null, { status: 499 });
    }

    let stream;
    try {
      stream = await resolveStream(id);
    } catch (e) {
      const res = NextResponse.json(
        { error: "Could not resolve stream", detail: e instanceof Error ? e.message : String(e) },
        { status: 502, headers: { "Retry-After": "30", "cache-control": "private, no-store" } },
      );
      setCors(res.headers);
      return res;
    }

    let upstream: Response;
    try {
      upstream = await fetch(stream.url, {
        headers: { range, "user-agent": UA, accept: "*/*" },
        signal: req.signal,
        // @ts-expect-error — undici option: don't buffer large media bodies
        duplex: "half",
      });
    } catch (fetchErr: unknown) {
      if (req.signal?.aborted) {
        return new Response(null, { status: 499 });
      }
      invalidateStream(id);
      continue;
    }

    lastStatus = upstream.status;
    if ([403, 404, 410].includes(upstream.status)) {
      // URL expired or was revoked — drop it and resolve again once.
      upstream.body?.cancel().catch(() => {});
      invalidateStream(id);
      continue;
    }
    if (!upstream.ok) {
      upstream.body?.cancel().catch(() => {});
      break;
    }

    const headers = new Headers();
    for (const h of PASS) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (!headers.has("content-type")) headers.set("content-type", stream.mimeType);
    headers.set("accept-ranges", "bytes");
    // no-store keeps Chrome from caching Range responses (a poisoned entry
    // would make every later play attempt fail instantly); no-transform stops
    // proxies from buffering the stream and killing our Range semantics.
    headers.set("cache-control", "private, no-store, no-transform");
    headers.set("X-Accel-Buffering", "no");
    headers.set("x-beatly-resolver", `${stream.backend}:${stream.client}`);
    setCors(headers);

    // If the client didn't ask for a range, present a normal 200 response.
    let status = upstream.status;
    if (!clientRange && status === 206) {
      status = 200;
      headers.delete("content-range");
    }
    return new Response(upstream.body, { status, headers });
  }

  const res = NextResponse.json({ error: "Upstream stream unavailable", status: lastStatus }, { status: 502 });
  setCors(res.headers);
  return res;
}

/** HEAD is used by the player to pre-warm the resolver for the next track. */
export async function HEAD(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) return new Response(null, { status: 400 });
  try {
    const s = await resolveStream(id);
    const headers = new Headers({
      "content-type": s.mimeType,
      "accept-ranges": "bytes",
      "cache-control": "private, no-store",
      "x-beatly-resolver": `${s.backend}:${s.client}`,
    });
    setCors(headers);
    if (s.contentLength) headers.set("content-length", String(s.contentLength));
    return new Response(null, { status: 200, headers });
  } catch {
    const headers = new Headers();
    setCors(headers);
    return new Response(null, { status: 502, headers });
  }
}
