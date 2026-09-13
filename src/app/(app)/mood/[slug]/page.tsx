import { notFound } from "next/navigation";
import { getProvider } from "@/lib/music";
import { findMood } from "@/lib/moods";
import { MoodView } from "@/components/MoodView";

export const revalidate = 1800;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const mood = findMood(slug);
  return { title: mood ? `${mood.label} — Beatly` : "Beatly" };
}

export default async function MoodPage({ params }: Props) {
  const { slug } = await params;
  const mood = findMood(slug);
  if (!mood) notFound();
  const tracks = await getProvider().trending({ genre: mood.q }).catch(() => []);
  return <MoodView mood={mood} tracks={tracks} />;
}
