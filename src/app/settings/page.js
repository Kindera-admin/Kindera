import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getCompaniesByIds } from '@/lib/company';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const company = user.companyId ? (await getCompaniesByIds([user.companyId])).get(String(user.companyId)) : null;

  // Plain strings only: a client component must not receive a Mongoose document.
  const profile = { name: user.name || '', role: user.role, email: user.email || '' };
  return <SettingsClient user={profile} companyLogo={company?.logoUrl || ''} />;
}
