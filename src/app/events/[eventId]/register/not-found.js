import { CalendarX } from 'lucide-react';
import StatusPage from '@/components/StatusPage';

export const metadata = { title: 'Event not found · Kindera' };

export default function EventNotFound() {
  return (
    <StatusPage
      icon={CalendarX}
      title="We couldn't find that event."
      message="It may have ended, been removed, or the link is incomplete."
      actions={[
        { label: 'See upcoming events', href: '/events' },
        { label: 'Go to home', href: '/' },
      ]}
      code="Error 404"
    />
  );
}
