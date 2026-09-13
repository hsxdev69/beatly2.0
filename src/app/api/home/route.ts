/**
 * GET /api/home?genre=romance&seed=0&refresh=1
 *
 * CRITICAL RULE: `genre` defaults to "romance". The feed only ever changes
 * away from Romantic when the client explicitly passes a different, real
 * genre/mood/language slug (i.e. the user tapped a specific chip). The full
 * 20-section "Made for India" mixed discovery feed is ONLY served when the
 * caller explicitly passes `genre=all` (the explicit "All India" chip).
 *
 *   - Global deduplication (per feed)
 *   - Refresh and seed rotation
 *   - In-memory TTL caching
 */
import { NextResponse } from "next/server";
import { getIndianHomeData } from "@/lib/indianHome";
import { getMoodFeed, getRomanticFeed, DEFAULT_GENRE } from "@/lib/genreFeed";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const seed = Number(url.searchParams.get("seed")) || 0;
    const refresh = url.searchParams.get("refresh") === "1";
    const genre = url.searchParams.get("genre")?.trim() || DEFAULT_GENRE;

    const data =
      genre === "all"
        ? await getIndianHomeData({ seed, refresh })
        : genre === DEFAULT_GENRE
          ? await getRomanticFeed(seed)
          : await getMoodFeed(genre, seed);

    return NextResponse.json({ success: true, data, genre });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { success: false, error: "Failed to generate home feed", detail },
      { status: 500 },
    );
  }
}
