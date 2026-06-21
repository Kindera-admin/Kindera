import { getEventById } from '@/app/actions';
import { notFound } from 'next/navigation';
import EventRegisterClient from './EventRegisterClient';

import { getCurrentUser } from '@/lib/auth';

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

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <EventRegisterClient event={result.event} currentUser={user} />
    </div>
  );
}
