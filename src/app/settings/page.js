import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getCompaniesByIds } from '@/lib/company';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const company = user.companyId ? (await getCompaniesByIds([user.companyId])).get(String(user.companyId)) : null;

  return <SettingsClient user={user} companyLogo={company?.logoUrl || ''} />;
}
