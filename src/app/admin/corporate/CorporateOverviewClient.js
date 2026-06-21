'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Building2, Users, Clock, CalendarDays, ArrowRight, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STAT_ICONS = {
  members: Users,
  hours: Clock,
  events: CalendarDays,
};

export default function CorporateOverviewClient({ orgs }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeOrg, setActiveOrg] = useState(null);

  const totalOrgs    = orgs.length;
  const totalMembers = orgs.reduce((s, o) => s + o.memberCount, 0);
  const totalHours   = orgs.reduce((s, o) => s + o.volunteerHours, 0);
  const totalEvents  = orgs.reduce((s, o) => s + o.eventsAttended, 0);

  const handleGenerate = (orgName) => {
    router.push(`/dashboard/team/generate?org=${encodeURIComponent(orgName)}`);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">Admin</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Corporate Overview</h1>
        <p className="text-gray-500 text-sm">All registered corporate volunteer organisations and their KPIs.</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Organisations', value: totalOrgs, color: '#0d3b26' },
          { label: 'Total Members', value: totalMembers, color: '#1a5c3a' },
          { label: 'Volunteer Hours', value: totalHours.toLocaleString(), color: '#2e7d52' },
          { label: 'Events Attended', value: totalEvents, color: '#3d5a99' },
        ].map(k => (
          <div key={k.label} className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm">
            <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">All Organisations</h2>
          <Button
            size="sm"
            onClick={() => router.push('/dashboard/team/generate')}
            className="gap-1.5 bg-[#0d3b26] hover:bg-[#1a5c3a] text-white"
          >
            <Plus className="w-4 h-4" />
            Generate Logins
          </Button>
        </div>

        {orgs.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No corporate organisations yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-6 py-3 text-left">Organisation</th>
                <th className="px-6 py-3 text-left">SPOC</th>
                <th className="px-6 py-3 text-right">Members</th>
                <th className="px-6 py-3 text-right">Hours</th>
                <th className="px-6 py-3 text-right">Events</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(org => (
                <tr key={org.spocId} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#0d3b26] flex items-center justify-center text-white text-xs font-bold">
                        {org.organizationName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{org.organizationName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{org.spocName}</td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-gray-800">{org.memberCount}</td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-[#0d3b26]">{org.volunteerHours.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-600">{org.eventsAttended}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleGenerate(org.organizationName)}
                      className="text-xs font-semibold text-[#0d3b26] hover:text-[#2e7d52] flex items-center gap-1 ml-auto transition-colors"
                    >
                      + Logins
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
