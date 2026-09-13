import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { playlists, playlistTracks } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ playlists: [] });
  const rows = await db
    .select({
      id: playlists.id,
      name: playlists.name,
      description: playlists.description,
      trackCount: sql<number>`count(${playlistTracks.id})::int`,
      artwork: sql<string | null>`(select ${playlistTracks.track}->>'artwork' from ${playlistTracks} where ${playlistTracks.playlistId} = ${playlists.id} order by ${playlistTracks.position} asc limit 1)`,
    })
    .from(playlists)
    .leftJoin(playlistTracks, eq(playlistTracks.playlistId, playlists.id))
    .where(eq(playlists.userId, user.id))
    .groupBy(playlists.id)
    .orderBy(desc(playlists.createdAt));
  return NextResponse.json({ playlists: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, description } = (await req.json()) as { name?: string; description?: string };
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const [playlist] = await db
    .insert(playlists)
    .values({ userId: user.id, name: name.trim(), description: description?.trim() || null })
    .returning();
  return NextResponse.json({ playlist });
}
