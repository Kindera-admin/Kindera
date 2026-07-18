import { getEventById, getEventRegisteredCount } from '@/app/actions';
import { notFound } from 'next/navigation';
import EventRegisterClient from './EventRegisterClient';
import { getCurrentUser } from '@/lib/auth';
import connectDB from '@/lib/db';
import User from '@/models/User';

export const metadata = {
  title: 'Register for Event | Kindera',
  description: 'Register as a volunteer for this Kindera event',
};

export default async function EventRegisterPage({ params }) {
  const { eventId } = params;
  const result = await getEventById(eventId);
  const user = await getCurrentUser();
  
  if (!result.success || !result.event) {
    notFound();
  }

  const { count: registeredCount = 0, spocCount = 0 } = await getEventRegisteredCount(eventId);

  let spocRegistered = false;
  if (user && user.role === 'org_member') {
    await connectDB();
    const spocDoc = await User.findOne({
      role: 'org_spoc',
      organizationName: user.organizationName,
      'eventRegistrations.eventId': eventId
    });
    spocRegistered = !!spocDoc;
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <EventRegisterClient 
        event={result.event} 
        currentUser={user} 
        registeredCount={registeredCount}
        spocCount={spocCount}
        spocRegistered={spocRegistered}
      />
    </div>
  );
}
