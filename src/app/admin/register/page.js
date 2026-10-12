import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import RegisterForm from './RegisterForm';
import { listCompanies } from '@/app/companyActions';

export default async function RegisterPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  if (user.role !== 'admin' && user.role !== 'employee') {
    redirect('/');
  }
  
  const { companies = [] } = user.role === 'admin' ? await listCompanies() : { companies: [] };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Suspense fallback={<div className="h-48 w-full bg-gray-50 rounded-2xl animate-pulse" />}>
        <RegisterForm userRole={user.role} companies={companies} />
      </Suspense>
    </div>
  );
}