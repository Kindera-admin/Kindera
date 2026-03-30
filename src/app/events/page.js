import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getEvents } from '@/app/actions';
import EventsClient from './EventsClient';

export default async function EventsPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  const result = await getEvents('upcoming');
  const events = result.success ? result.events : [];
  
  return <EventsClient events={events} userRole={user.role} />;
}
