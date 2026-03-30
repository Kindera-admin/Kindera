import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import CreateEventForm from './CreateEventForm';

export default async function CreateEventPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  // Only admin, NGO, and org_spoc can create events
  if (!['admin', 'ngo', 'org_spoc'].includes(user.role)) {
    redirect('/home');
  }
  
  return <CreateEventForm />;
}
