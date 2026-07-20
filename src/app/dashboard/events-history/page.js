import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getOrgEventsHistory } from '@/app/actions';
import CorporateEventsHistoryClient from './CorporateEventsHistoryClient';

export default async function CorporateEventsHistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  
  if (user.role !== 'org_spoc' && user.role !== 'org_member') {
    redirect('/dashboard');
  }

  const { history = [] } = await getOrgEventsHistory(user.organizationName);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <CorporateEventsHistoryClient history={history} userRole={user.role} />
    </div>
  );
}
