import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getMyImpact } from '@/app/actions';
import MyImpactClient from './MyImpactClient';

export default async function MyImpactPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'org_member') redirect('/dashboard');

  const { events = [], stats = {} } = await getMyImpact();

  return <MyImpactClient events={events} stats={stats} />;
}
