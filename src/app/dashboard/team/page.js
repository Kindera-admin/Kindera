import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getOrgMembers, getOrgStats } from '@/app/actions';
import TeamClient from './TeamClient';

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'org_spoc' && user.role !== 'admin') redirect('/dashboard');

  const orgName = user.organizationName;
  const [membersResult, statsResult] = await Promise.all([
    getOrgMembers(orgName),
    getOrgStats(orgName),
  ]);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <TeamClient
        members={membersResult.members || []}
        stats={statsResult.stats || {}}
        orgName={orgName}
      />
    </div>
  );
}
