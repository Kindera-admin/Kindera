import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getCompaniesByIds } from '@/lib/company';
import { ngoEventCompanies } from '@/lib/ngo';
import connectDB from '@/lib/db';
import NGOPartner from '@/models/NGOPartner';
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

  // An NGO linked to a company card must pick one of that card's companies.
  let companyChoices = [];
  if (user.role === 'ngo' && user.ngoPartnerId) {
    await connectDB();
    const partner = await NGOPartner.findById(user.ngoPartnerId).select('companyIds').lean();
    const allowed = ngoEventCompanies(user, partner).filter(Boolean);
    if (allowed.length > 0) {
      const companies = await getCompaniesByIds(allowed);
      companyChoices = allowed.map((id) => ({ _id: id, name: companies.get(id)?.name || 'Company' }));
    }
  }

  return <CreateEventForm companyChoices={companyChoices} />;
}
