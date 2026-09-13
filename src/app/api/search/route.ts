import { NextResponse } from "next/server";
import { getProvider } from "@/lib/music";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ tracks: [], artists: [], collections: [] });
  try {
    const result = await getProvider().search(q);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ tracks: [], artists: [], collections: [], error: "Search unavailable" }, { status: 502 });
  }
}
