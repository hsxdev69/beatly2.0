import { notFound } from "next/navigation";
import Link from "next/link";
import { getProvider, formatDuration } from "@/lib/music";
import { TrackList } from "@/components/TrackList";
import { PageHeader, PlayAllButton } from "@/components/Cards";
import { Artwork } from "@/components/Artwork";

export const revalidate = 3600;
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const data = await getProvider().collection(id);
  return { title: data ? `${data.collection.name} — Beatly` : "Beatly" };
}

export default async function CollectionPage({ params }: Props) {
  const { id } = await params;
  const data = await getProvider().collection(id);
  if (!data) notFound();
  const { collection, tracks } = data;
  const total = tracks.reduce((a, t) => a + t.duration, 0);
  const artistId = tracks.find((t) => t.artistId)?.artistId;
  return (
    <div className="pb-6">
      <div className="relative">
        {collection.artwork && <div className="absolute inset-x-0 top-0 h-96 bg-cover bg-center opacity-40 blur-3xl" style={{ backgroundImage: `url(${collection.artwork})` }} />}
        <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-transparent to-black" />
        <div className="relative">
          <PageHeader title="" />
          <div className="flex flex-col items-center gap-4 px-4 pb-5 md:flex-row md:items-end md:px-6">
            <Artwork src={collection.artwork} alt={collection.name} iconSize={64} className="h-52 w-52 rounded-3xl shadow-2xl md:h-56 md:w-56" />
            <div className="min-w-0 text-center md:text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-white/70">{collection.isAlbum ? "Album" : "Playlist"}</p>
              <h1 className="text-2xl font-black md:text-4xl">{collection.name}</h1>
              <p className="mt-2 text-sm text-white/80">
                {collection.isAlbum && artistId ? <Link href={`/artist/${artistId}`} className="font-semibold hover:underline">{collection.artist}</Link> : <span className="font-semibold">{collection.artist}</span>}
                {collection.year ? ` · ${collection.year}` : ""} · {tracks.length} songs{total > 0 ? `, ${formatDuration(total)}` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 md:px-6"><PlayAllButton tracks={tracks} /></div>
      <div className="px-2 md:px-4">
        {tracks.length ? <TrackList tracks={tracks} /> : <p className="px-4 text-muted">No playable songs in this collection.</p>}
      </div>
    </div>
  );
}
