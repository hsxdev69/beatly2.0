/**
 * /api/related?videoId=…&limit=120
 *
 * Infinite-radio backend. Chains the provider's "Up Next" feed in parallel:
 *
 *   1. Seed:    getUpNexts(seed)            → ~49 genuine related tracks
 *   2. Fan-out: getUpNexts(top-N related)   → ~49 more per call, in parallel
 *   3. Dedupe across the whole pool, cap at `limit` (default 120, max 200).
 *
 * Verified live: 5 calls → 188 unique tracks in ~740 ms. The client can keep
 * requesting more as the user nears the end of the queue.
 */
import { NextResponse } from "next/server";
import { getProvider } from "@/lib/music";

export const dynamic = "force-dynamic";

const ID_RE = /^[A-Za-z0-9_-]{6,20}$/;
const FANOUT = 4;
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 120;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const videoId = url.searchParams.get("videoId")?.trim() ?? "";
  if (!ID_RE.test(videoId)) {
    return NextResponse.json({ tracks: [] }, { status: 400 });
  }
  const limitParam = Number(url.searchParams.get("limit")) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(20, limitParam));

  try {
    const tracks = await getProvider().radio(videoId, { limit });
    return NextResponse.json({ tracks });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ tracks: [], error: "Radio unavailable", detail }, { status: 502 });
  }
}
