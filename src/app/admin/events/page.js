import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getEvents } from '@/app/actions';
import EventsClient from '@/app/events/EventsClient';

export default async function AdminEventsPage() {
  const user = await getCurrentUser();

  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');

  const { events = [] } = await getEvents();

  return (
    <div className="p-6">
      <EventsClient events={events} userRole="admin" />
    </div>
  );
}
