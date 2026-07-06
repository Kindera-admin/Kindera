import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getEvents } from '@/app/actions';
import AttendanceIndexClient from './AttendanceIndexClient';

export default async function AttendanceIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin' && user.role !== 'org_spoc') redirect('/dashboard');

  // Fetch all events (not just upcoming) so SPOC can mark attendance for past ones too
  const result = await getEvents();
  const events = (result.success ? result.events : []).filter(
    (e) => user.role === 'admin' || e.createdByRole === 'org_spoc'
  );

  return <AttendanceIndexClient events={events} />;
}
