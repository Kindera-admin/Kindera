import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getAllEventsHistory } from '@/app/actions';
import EventsHistoryClient from './EventsHistoryClient';

export default async function AdminEventsHistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin' && user.role !== 'employee') redirect('/dashboard');

  const { history = [] } = await getAllEventsHistory();

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <EventsHistoryClient history={history} userRole={user.role} />
    </div>
  );
}
