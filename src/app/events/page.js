import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getEvents, getMyRegisteredEventIds } from '@/app/actions';
import EventsClient from './EventsClient';

export default async function EventsPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  const [result, regResult] = await Promise.all([
    getEvents('upcoming'),
    getMyRegisteredEventIds(),
  ]);
  const events = result.success ? result.events : [];
  const approvedEventIds = regResult.approvedEventIds || [];
  const pendingEventIds = regResult.pendingEventIds || [];
  
  return <EventsClient events={events} userRole={user.role} approvedEventIds={approvedEventIds} pendingEventIds={pendingEventIds} />;
}
