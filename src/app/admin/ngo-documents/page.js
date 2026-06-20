import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getAllNGODocuments } from '@/app/actions';
import NGODocumentsClient from './NGODocumentsClient';

export default async function AdminNGODocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');

  const { ngos = [] } = await getAllNGODocuments();

  return (
    <div className="w-full max-w-5xl mx-auto">
      <NGODocumentsClient ngos={ngos} />
    </div>
  );
}
