import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getNGODocuments } from '@/app/actions';
import DocumentsClient from './DocumentsClient';

export default async function DocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ngo') redirect('/dashboard');

  const { documents = [] } = await getNGODocuments();

  return (
    <div className="w-full max-w-3xl mx-auto">
      <DocumentsClient documents={documents} />
    </div>
  );
}
