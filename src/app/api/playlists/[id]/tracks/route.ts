import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { playlists, playlistTracks, type TrackSnapshot } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

async function owned(id: number) {
  const user = await getCurrentUser();
  if (!user) return null;
  const [pl] = await db.select().from(playlists).where(and(eq(playlists.id, id), eq(playlists.userId, user.id)));
  return pl ?? null;
}

export async function POST(req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  const pl = await owned(id);
  if (!pl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { track } = (await req.json()) as { track: TrackSnapshot };
  if (!track?.id) return NextResponse.json({ error: "Invalid track" }, { status: 400 });
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${playlistTracks.position}), 0)::int` })
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, id));
  const [row] = await db
    .insert(playlistTracks)
    .values({ playlistId: id, trackId: track.id, track, position: max + 1 })
    .returning();
  await db.update(playlists).set({ updatedAt: new Date() }).where(eq(playlists.id, id));
  return NextResponse.json({ row });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  const pl = await owned(id);
  if (!pl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { rowId } = (await req.json()) as { rowId: number };
  await db.delete(playlistTracks).where(and(eq(playlistTracks.id, rowId), eq(playlistTracks.playlistId, id)));
  return NextResponse.json({ ok: true });
}
