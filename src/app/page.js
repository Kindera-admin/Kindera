import HomePageClient from './HomePageClient';
import { getHomeEvents, getImpactPhotos } from "@/app/actions";

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { events: upcomingEvents = [] } = await getHomeEvents();
  const { photos: impactPhotos = [] } = await getImpactPhotos();

  return <HomePageClient upcomingEvents={upcomingEvents} impactPhotos={impactPhotos} />;
}