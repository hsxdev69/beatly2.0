import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { getProvider } from "@/lib/music";
import { TrackList } from "@/components/TrackList";
import { CollectionCard, PageHeader, PlayAllButton, Section, Shelf } from "@/components/Cards";
import { Artwork } from "@/components/Artwork";

export const revalidate = 3600;
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const data = await getProvider().artist(id);
  return { title: data ? `${data.artist.name} — Beatly` : "Artist — Beatly" };
}

export default async function ArtistPage({ params }: Props) {
  const { id } = await params;
  const data = await getProvider().artist(id);
  if (!data) notFound();
  const { artist, tracks, albums } = data;
  return (
    <div className="pb-6">
      <div className="relative">
        {artist.cover && <div className="absolute inset-x-0 top-0 h-80 bg-cover bg-center opacity-50 blur-2xl" style={{ backgroundImage: `url(${artist.cover})` }} />}
        <div className="absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-transparent to-black" />
        <div className="relative">
          <PageHeader title="" />
          <div className="flex items-end gap-4 px-4 pb-5 md:px-6">
            <Artwork src={artist.avatar} alt={artist.name} iconSize={48} className="h-32 w-32 rounded-full shadow-2xl md:h-44 md:w-44" />
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-white/70"><BadgeCheck size={16} className="text-sky-400" /> Artist</p>
              <h1 className="truncate text-3xl font-black md:text-5xl">{artist.name}</h1>
              <p className="mt-1 text-sm text-white/80">{tracks.length} songs · {albums.length} releases</p>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 md:px-6"><PlayAllButton tracks={tracks} /></div>
      {tracks.length > 0 && (
        <Section title="Popular"><div className="px-2 md:px-4"><TrackList tracks={tracks} /></div></Section>
      )}
      {albums.length > 0 && (
        <Section title="Albums & singles"><Shelf>{albums.map((a) => <CollectionCard key={a.id} collection={a} />)}</Shelf></Section>
      )}
      {tracks.length === 0 && albums.length === 0 && <p className="px-4 text-muted md:px-6">No songs found for this artist.</p>}
    </div>
  );
}
