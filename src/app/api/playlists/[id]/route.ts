import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { playlists, playlistTracks } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

async function owned(id: number) {
  const user = await getCurrentUser();
  if (!user) return null;
  const [pl] = await db.select().from(playlists).where(and(eq(playlists.id, id), eq(playlists.userId, user.id)));
  return pl ?? null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  const pl = await owned(id);
  if (!pl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const tracks = await db
    .select({ rowId: playlistTracks.id, track: playlistTracks.track })
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, id))
    .orderBy(asc(playlistTracks.position), asc(playlistTracks.id));
  return NextResponse.json({ playlist: pl, tracks });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  const pl = await owned(id);
  if (!pl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json()) as { name?: string; description?: string };
  const [updated] = await db
    .update(playlists)
    .set({
      name: body.name?.trim() || pl.name,
      description: body.description !== undefined ? body.description.trim() || null : pl.description,
      updatedAt: new Date(),
    })
    .where(eq(playlists.id, id))
    .returning();
  return NextResponse.json({ playlist: updated });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  const pl = await owned(id);
  if (!pl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.delete(playlists).where(eq(playlists.id, id));
  return NextResponse.json({ ok: true });
}
