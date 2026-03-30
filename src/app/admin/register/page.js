import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import RegisterForm from './RegisterForm';

export default async function RegisterPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  if (user.role !== 'admin') {
    redirect('/');
  }
  
  return (
    <div className="w-full max-w-2xl mx-auto">
      <RegisterForm />
    </div>
  );
}