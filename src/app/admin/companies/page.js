import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listCompanies } from '@/app/companyActions';
import CompaniesClient from './CompaniesClient';

export const metadata = { title: 'Companies · Kindera' };

export default async function CompaniesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin' && user.role !== 'employee') redirect('/dashboard');

  const { companies = [] } = await listCompanies({ includeArchived: true });
  return (
    <div className="w-full max-w-6xl mx-auto">
      <CompaniesClient companies={companies} />
    </div>
  );
}
