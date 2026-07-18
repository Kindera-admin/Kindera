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
  } else if (user.role === 'org_spoc') {
    // Find all events where members of this SPOC's organization have registered
    const orgUsers = await User.find({ organizationName: user.organizationName }).select('eventRegistrations');
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
    events = allEvents.filter(e => 
      e.createdBy && (
        e.createdBy._id.toString() === user._id.toString() || 
        (!e.organizationName && registeredEventIds.has(e._id.toString()))
      )
    );
  }

  return <AttendanceIndexClient events={events} />;
}
