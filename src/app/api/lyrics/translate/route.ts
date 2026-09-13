/**
 * POST /api/lyrics/translate — real-time lyrics translation for the
 * multi-language switcher in LyricsView.
 *
 * Body: { texts: string[], target: string, source?: string }
 *   - target: ISO code (en, hi, es, ...) or "romaji" for romanization
 *   - source: ISO code or "auto" (default)
 *
 * Strategy:
 *   - "romaji": fully offline romanization (wanakana for Japanese,
 *     `transliteration` for every other script). Instant, no quota.
 *   - other: Lingva Translate (Google-backed, key-less) in small batches,
 *     with MyMemory as a per-line fallback. Line-level cache included.
 */
import { NextResponse } from "next/server";
import { toRomaji } from "wanakana";
import { transliterate } from "transliteration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINGVA = "https://lingva.ml/api/v1";
const MAX_TEXTS = 300;
const MAX_CHARS = 1800; // keep Lingva GET urls short
const CACHE_LIMIT = 2000;

// line-level cache: `${source}|${target}|${text}` -> translated
const lineCache = new Map<string, string>();
function cacheGet(k: string) {
  const v = lineCache.get(k);
  if (v !== undefined) {
    // refresh LRU position
    lineCache.delete(k);
    lineCache.set(k, v);
  }
  return v;
}
function cacheSet(k: string, v: string) {
  lineCache.set(k, v);
  if (lineCache.size > CACHE_LIMIT) {
    const oldest = lineCache.keys().next().value;
    if (oldest !== undefined) lineCache.delete(oldest);
  }
}

const HAS_JAPANESE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef]/;
const HAS_NON_LATIN = /[^\u0000-\u024f\u1e00-\u1eff\s\d\p{P}]/u;

function romanizeLine(text: string): string {
  if (!text.trim() || text.trim() === "♪") return text;
  if (!HAS_NON_LATIN.test(text)) return text; // already Latin
  let out = text;
  try {
    // wanakana first: best-quality kana → romaji
    if (HAS_JAPANESE.test(out)) out = toRomaji(out);
  } catch {
    /* fall through */
  }
  try {
    // transliterate() catches whatever non-Latin remains (kanji, hanzi,
    // devanagari, arabic, cyrillic, ...).
    if (HAS_NON_LATIN.test(out)) out = transliterate(out) || out;
  } catch {
    /* keep partial result */
  }
  return out;
}

async function lingvaBatch(
  batch: string[],
  source: string,
  target: string,
): Promise<string[] | null> {
  const joined = batch.join("\n");
  const url = `${LINGVA}/${encodeURIComponent(source)}/${encodeURIComponent(target)}/${encodeURIComponent(joined)}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: { accept: "application/json", "user-agent": "EchoMusic/1.0" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { translation?: string };
    if (!json.translation) return null;
    const out = json.translation.split("\n");
    // Lingva usually preserves newlines; tolerate minor drift
    if (out.length === batch.length) return out.map((s) => s.trim());
    // If it collapsed everything, signal mismatch so caller retries per-line
    return null;
  } catch {
    return null;
  }
}

async function myMemoryLine(
  text: string,
  source: string,
  target: string,
): Promise<string | null> {
  if (!text.trim()) return text;
  try {
    const params = new URLSearchParams({
      q: text,
      langpair: `${source === "auto" ? "en" : source}|${target}`,
    });
    const res = await fetch(`https://api.mymemory.translated.net/get?${params}`, {
      signal: AbortSignal.timeout(10000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number;
    };
    const t = json.responseData?.translatedText?.trim();
    if (!t || json.responseStatus !== 200) return null;
    return t;
  } catch {
    return null;
  }
}

function chunkByChars(texts: string[]): string[][] {
  const chunks: string[][] = [];
  let cur: string[] = [];
  let len = 0;
  for (const t of texts) {
    if (cur.length > 0 && len + t.length + 1 > MAX_CHARS) {
      chunks.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(t);
    len += t.length + 1;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

export async function POST(req: Request) {
  let body: { texts?: unknown; target?: unknown; source?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { texts, target, source } = body;
  if (
    !Array.isArray(texts) ||
    texts.length === 0 ||
    texts.length > MAX_TEXTS ||
    !texts.every((t): t is string => typeof t === "string")
  ) {
    return NextResponse.json({ error: "texts must be a non-empty string array" }, { status: 400 });
  }
  if (typeof target !== "string" || !/^[a-z-]{2,8}$/i.test(target)) {
    return NextResponse.json({ error: "target must be a language code" }, { status: 400 });
  }
  const src = typeof source === "string" && /^[a-z-]{2,8}$/i.test(source) ? source : "auto";
  const tgt = target.toLowerCase();

  // ---- Romaji: instant offline romanization, no network ----
  if (tgt === "romaji" || tgt === "romanized" || tgt === "latn") {
    return NextResponse.json({ translations: texts.map(romanizeLine), engine: "offline" });
  }

  // ---- Skip work for empty / musical-note lines ----
  const result: (string | null)[] = new Array(texts.length).fill(null);
  const needIdx: number[] = [];
  texts.forEach((t, i) => {
    if (!t.trim() || t.trim() === "♪") result[i] = t;
    else {
      const hit = cacheGet(`${src}|${tgt}|${t}`);
      if (hit !== undefined) result[i] = hit;
      else needIdx.push(i);
    }
  });
  if (needIdx.length === 0) {
    return NextResponse.json({ translations: result, engine: "cache" });
  }

  // ---- Batch through Lingva ----
  const needTexts = needIdx.map((i) => texts[i]);
  const chunks = chunkByChars(needTexts);
  // map chunk-local position back to global index
  let cursor = 0;
  const chunkMaps: number[][] = chunks.map((c) => {
    const m = needIdx.slice(cursor, cursor + c.length);
    cursor += c.length;
    return m;
  });

  const translated = await Promise.all(
    chunks.map(async (chunk, ci) => {
      const batched = await lingvaBatch(chunk, src, tgt);
      if (batched) return { ci, lines: batched };
      // Fallback: per-line MyMemory (parallel, small batches)
      const lines = await Promise.all(chunk.map((t) => myMemoryLine(t, src, tgt)));
      return { ci, lines };
    }),
  );

  const missing: number[] = [];
  for (const { ci, lines } of translated) {
    chunkMaps[ci].forEach((globalIdx, k) => {
      const t = lines[k];
      if (t) {
        result[globalIdx] = t;
        cacheSet(`${src}|${tgt}|${texts[globalIdx]}`, t);
      } else {
        missing.push(globalIdx);
      }
    });
  }

  // Final safety: untranslated lines fall back to the original text
  for (const i of missing) result[i] = texts[i];

  return NextResponse.json({
    translations: result,
    engine: missing.length ? "partial" : "lingva",
  });
}
