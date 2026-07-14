import HomePageClient from './HomePageClient';
import { getHomeEvents, getImpactPhotos, getImpactStats } from "@/app/actions";

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { events: upcomingEvents = [] } = await getHomeEvents();
  const { photos: impactPhotos = [] } = await getImpactPhotos();
  const { stats = {} } = await getImpactStats();

  return <HomePageClient upcomingEvents={upcomingEvents} impactPhotos={impactPhotos} stats={stats} />;
}