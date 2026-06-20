import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getAllCorporateStats } from '@/app/actions';
import CorporateOverviewClient from './CorporateOverviewClient';

export default async function AdminCorporatePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');

  const { orgs = [] } = await getAllCorporateStats();

  return (
    <div className="w-full max-w-6xl mx-auto">
      <CorporateOverviewClient orgs={orgs} />
    </div>
  );
}
