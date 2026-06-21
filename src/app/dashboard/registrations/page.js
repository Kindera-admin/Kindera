import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getPendingEventRegistrations } from '@/app/actions';
import RegistrationsClient from './RegistrationsClient';

export default async function RegistrationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  
  // Only organizers (NGO, SPOC, Admin) can manage event registrations
  if (!['ngo', 'org_spoc', 'admin'].includes(user.role)) {
    redirect('/dashboard');
  }

  const { users } = await getPendingEventRegistrations();

  return (
    <div className="w-full max-w-6xl mx-auto">
      <RegistrationsClient initialUsers={users || []} />
    </div>
  );
}
