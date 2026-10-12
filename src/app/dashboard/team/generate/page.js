import { redirect } from 'next/navigation';
import { isValidObjectId } from 'mongoose';
import { getCurrentUser } from '@/lib/auth';
import { getCompanyName } from '@/lib/company';
import GenerateLoginsClient from './GenerateLoginsClient';

export default async function GenerateLoginsPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin' && user.role !== 'org_spoc') redirect('/dashboard');

  // SPOCs: their own company. Admins: the company chosen on the Corporate overview.
  // The query value comes from the URL, so a malformed one is treated as missing.
  const params = await searchParams;
  const requested = typeof params?.company === 'string' && isValidObjectId(params.company) ? params.company : null;
  const companyId = user.role === 'org_spoc' ? (user.companyId ? String(user.companyId) : null) : requested;
  if (!companyId) redirect(user.role === 'admin' ? '/admin/corporate' : '/dashboard');
  const companyName = await getCompanyName(companyId);
  if (!companyName) redirect(user.role === 'admin' ? '/admin/corporate' : '/dashboard');

  return (
    <div className="w-full max-w-4xl mx-auto">
      <GenerateLoginsClient role={user.role} companyId={companyId} companyName={companyName} />
    </div>
  );
}
