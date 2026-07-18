import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return <SettingsClient user={user} />;
}
