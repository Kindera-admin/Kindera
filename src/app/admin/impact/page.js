import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getAdminImpactStats } from '@/app/actions';
import ImpactDashboardClient from './ImpactDashboardClient';

export const dynamic = 'force-dynamic';

export default async function AdminImpactPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');

  const year = searchParams?.year || new Date().getFullYear();
  const { stats = {}, success } = await getAdminImpactStats(year);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <ImpactDashboardClient stats={stats} selectedYear={year} />
    </div>
  );
}
