import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getAllNGOPartners } from '@/app/actions';
import NGOPartnersClient from './NGOPartnersClient';

export default async function AdminNGOPartnersPage() {
  const user = await getCurrentUser();

  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');

  const { partners = [] } = await getAllNGOPartners();

  return (
    <div className="p-6">
      <NGOPartnersClient initialPartners={partners} />
    </div>
  );
}
