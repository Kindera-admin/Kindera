'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Clock, Settings, Download, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TeamClient({ members, stats, orgName }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">Corporate Team</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">{orgName} Volunteers</h1>
          <p className="text-gray-500 text-sm">Manage your team members and track their volunteering hours.</p>
        </div>
        <Button
          onClick={() => router.push('/dashboard/team/generate')}
          className="gap-2 bg-[#0d3b26] hover:bg-[#1a5c3a] text-white"
        >
          <Plus className="w-4 h-4" />
          Generate Logins
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Volunteers', value: stats.totalVolunteers || 0, color: '#0d3b26' },
          { label: 'Volunteer Hours', value: (stats.volunteerHours || 0).toLocaleString(), color: '#1a5c3a' },
          { label: 'Events Attended', value: stats.eventsAttended || 0, color: '#2e7d52' },
          { label: 'Avg Feedback', value: stats.avgFeedback ? `${stats.avgFeedback}/5` : '-', color: '#3d5a99' },
        ].map(k => (
          <div key={k.label} className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm">
            <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Team List */}
      <div className="border border-gray-100 rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0d3b26]"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No members found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Username</th>
                  <th className="px-6 py-3 text-right">Hours</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(member => (
                  <tr key={member._id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#e8f5e9] text-[#2e7d52] flex items-center justify-center font-bold text-xs shrink-0">
                          {member.name.charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-gray-900 text-sm truncate">{member.name}</span>
                          {(member.organizationName || member.ngoId) && (
                            <span className="text-xs text-gray-500 truncate">
                              {member.organizationName || member.ngoId}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">{member.username}</td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-[#0d3b26]">
                      {member.totalVolunteerHours}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                        member.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {member.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
