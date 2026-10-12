import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getEvents } from '@/app/actions';
import AttendanceIndexClient from './AttendanceIndexClient';
import connectDB from '@/lib/db';
import User from '@/models/User';

export default async function AttendanceIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin' && user.role !== 'org_spoc') redirect('/dashboard');

  await connectDB();

  let events = [];
  if (user.role === 'admin') {
    const result = await getEvents({ includeEnded: true });
    events = result.success ? result.events : [];
  } else if (user.role === 'org_spoc' && user.companyId) {
    // Find all events where members of this SPOC's company have registered
    const orgUsers = await User.find({ companyId: user.companyId }).select('eventRegistrations');
    const registeredEventIds = new Set();
    for (const u of orgUsers) {
      for (const r of u.eventRegistrations) {
        if (r.status === 'approved' || r.status === 'pending') {
          registeredEventIds.add(r.eventId.toString());
        }
      }
    }

    const result = await getEvents({ includeEnded: true });
    const allEvents = result.success ? result.events : [];
    events = allEvents.filter((e) =>
      e.companyId
        ? e.companyId === String(user.companyId)       // any internal event of this company
        : registeredEventIds.has(e._id.toString())     // public events the company joined
    );
  }

  return <AttendanceIndexClient events={events} />;
}
