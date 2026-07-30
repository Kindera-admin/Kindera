import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getDetailedDirectoryStats } from '@/app/actions';
import DirectoryClient from './DirectoryClient';

export default async function AdminDirectoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin' && user.role !== 'employee') redirect('/dashboard');

  const { success, spocs = [], ngos = [] } = await getDetailedDirectoryStats();

  return (
    <div className="w-full max-w-6xl mx-auto">
      <DirectoryClient spocs={spocs} ngos={ngos} />
    </div>
  );
}
