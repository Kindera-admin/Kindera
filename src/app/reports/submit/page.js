import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import SubmitForm from './SubmitForm';

export default async function SubmitReportPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Convert user to a plain object
  const plainUser = JSON.parse(JSON.stringify(user));

  return (
    <div className="w-full max-w-2xl mx-auto">
      <SubmitForm user={plainUser} />
    </div>
  );
}