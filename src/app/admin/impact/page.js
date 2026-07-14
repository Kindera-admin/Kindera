import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getAdminImpactStats } from '@/app/actions';
import ImpactDashboardClient from './ImpactDashboardClient';

export const dynamic = 'force-dynamic';

export default async function AdminImpactPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');

  const { stats = {}, success } = await getAdminImpactStats();

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <ImpactDashboardClient stats={stats} />
    </div>
  );
}
