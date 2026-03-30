import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import UsersClient from './UsersClient';
import { getAllUsers } from '@/app/actions';

export default async function UsersPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  if (user.role !== 'admin') {
    redirect('/');
  }
  
  const response = await getAllUsers();
  const users = response.success ? response.users : [];
  
  return <UsersClient initialUsers={users} currentUserId={user._id.toString()} />;
}