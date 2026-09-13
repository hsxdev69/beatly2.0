import { getRomanticFeed } from "@/lib/genreFeed";
import { HomeFeed } from "@/components/HomeFeed";

export const revalidate = 600;

/**
 * Initial server-rendered load is ALWAYS the Romantic feed — the home
 * screen must never default to trending/mixed content. Users only leave
 * this state by explicitly tapping a different genre/mood/language chip
 * client-side (handled in <HomeFeed />).
 */
const EMPTY_ROMANTIC_FEED = {
  sections: [],
  hero: [],
  featuredToday: null,
  generatedAt: 0,
  seed: 0,
};

export default async function HomePage() {
  const homeData = await getRomanticFeed(0).catch(() => EMPTY_ROMANTIC_FEED);

  return <HomeFeed initialData={homeData} initialGenre="romance" />;
}
