import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import DashboardClient from '../dashboard/DashboardClient';

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');

  return <DashboardClient />;
}
