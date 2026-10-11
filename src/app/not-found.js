import { Compass } from 'lucide-react';
import StatusPage from '@/components/StatusPage';
import { getCurrentUser } from '@/lib/auth';

export const metadata = { title: 'Page not found · Kindera' };

export default async function NotFound() {
  const user = await getCurrentUser();
  const actions = [
    { label: 'Go to home', href: '/' },
    { label: 'Browse events', href: '/events' },
  ];
  if (user) {
    const isStaff = user.role === 'admin' || user.role === 'employee';
    actions.splice(1, 0, { label: 'Open dashboard', href: isStaff ? '/admin' : '/dashboard' });
  }

  return (
    <StatusPage
      icon={Compass}
      title="This path isn't on the map."
      message="The page you're looking for doesn't exist or has moved."
      actions={actions}
      code="Error 404"
    />
  );
}
