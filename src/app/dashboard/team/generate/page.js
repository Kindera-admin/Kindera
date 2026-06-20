import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import GenerateLoginsClient from './GenerateLoginsClient';

export default async function GenerateLoginsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin' && user.role !== 'org_spoc') redirect('/dashboard');

  return (
    <div className="w-full max-w-4xl mx-auto">
      <GenerateLoginsClient role={user.role} defaultOrg={user.organizationName || ''} />
    </div>
  );
}
