import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getChatContacts, getMyAnnouncements } from '@/app/actions';
import ChatClient from './ChatClient';

export const metadata = {
  title: 'Messages | Kindera',
  description: 'Secure messaging between NGOs, Admins and Corporate SPOCs',
};

export default async function MessagesPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const allowedRoles = ['admin', 'ngo', 'org_spoc', 'employee', 'org_member'];
  if (!allowedRoles.includes(user.role)) redirect('/dashboard');

  const { contacts = [] } = await getChatContacts();
  const { announcements = [] } = await getMyAnnouncements();
  const params = await searchParams;
  const initialContactId = params?.contact || null;

  return (
    <ChatClient
      contacts={contacts}
      announcements={announcements}
      currentUser={{
        _id: user._id.toString(),
        name: user.name,
        role: user.role,
      }}
      initialContactId={initialContactId}
    />
  );
}
