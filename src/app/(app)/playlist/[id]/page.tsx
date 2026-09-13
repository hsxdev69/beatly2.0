import { PlaylistView } from "@/components/PlaylistView";

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlaylistView id={Number(id)} />;
}
