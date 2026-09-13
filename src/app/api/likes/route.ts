import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { likedSongs, type TrackSnapshot } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ids: [], tracks: [] });
  const rows = await db
    .select({ trackId: likedSongs.trackId, track: likedSongs.track })
    .from(likedSongs)
    .where(eq(likedSongs.userId, user.id))
    .orderBy(desc(likedSongs.likedAt));
  return NextResponse.json({ ids: rows.map((r) => r.trackId), tracks: rows.map((r) => r.track) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { track } = (await req.json()) as { track: TrackSnapshot };
  if (!track?.id) return NextResponse.json({ error: "Invalid track" }, { status: 400 });
  await db
    .insert(likedSongs)
    .values({ userId: user.id, trackId: track.id, track })
    .onConflictDoNothing();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { track } = (await req.json()) as { track: TrackSnapshot };
  await db.delete(likedSongs).where(and(eq(likedSongs.userId, user.id), eq(likedSongs.trackId, track.id)));
  return NextResponse.json({ ok: true });
}
