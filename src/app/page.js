import HomePageClient from './HomePageClient';
import { getHomeEvents } from "@/app/actions";

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { events: upcomingEvents = [] } = await getHomeEvents();

  return <HomePageClient upcomingEvents={upcomingEvents} />;
}