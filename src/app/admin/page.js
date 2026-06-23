import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import DashboardClient from '../dashboard/DashboardClient';

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) redirect('/login');
  if (user.role !== 'admin' && user.role !== 'employee') redirect('/dashboard');

  return <DashboardClient userRole={user.role} />;
}
