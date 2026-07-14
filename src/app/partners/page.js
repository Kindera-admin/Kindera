import { getAllNGOPartners } from '@/app/actions';
import PartnersClient from './PartnersClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Our NGO Partners | Kindera',
  description: 'Kindera collaborates with outstanding non-profits and NGOs to deliver CSR impact.',
};

export default async function PartnersPage() {
  const { partners = [] } = await getAllNGOPartners();

  return <PartnersClient partners={partners} />;
}
