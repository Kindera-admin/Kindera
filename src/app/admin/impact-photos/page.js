import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getImpactPhotos } from '@/app/actions';
import ImpactPhotosClient from './ImpactPhotosClient';

export default async function ImpactPhotosPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');

  const { photos } = await getImpactPhotos();

  return (
    <div className="w-full max-w-6xl mx-auto">
      <ImpactPhotosClient initialPhotos={photos || []} />
    </div>
  );
}
