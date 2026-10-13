import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getMyNGOs } from '@/app/actions';
import MyNGOsClient from './MyNGOsClient';

export const metadata = { title: 'My NGOs · Kindera' };

export default async function MyNGOsPage() {
  const user = await getCurrentUser();

  if (!user) redirect('/login');
  if (user.role !== 'org_spoc' && user.role !== 'org_member') redirect('/dashboard');

  const result = await getMyNGOs();

  return (
    <div className="w-full max-w-6xl mx-auto">
      <MyNGOsClient partners={result.partners || []} error={result.success ? null : result.message} />
    </div>
  );
}
