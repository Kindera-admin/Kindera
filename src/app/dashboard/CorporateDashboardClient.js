'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { Users, Clock, CalendarDays, Building2, Plus, UsersRound, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function CorporateDashboardClient({ stats, monthly }) {
  const router = useRouter();

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Volunteers', value: stats.totalVolunteers || 0, color: '#0d3b26' },
          { label: 'Volunteer Hours', value: (stats.volunteerHours || 0).toLocaleString(), color: '#1a5c3a' },
          { label: 'Events Attended', value: stats.eventsAttended || 0, color: '#2e7d52' },
          { label: 'NGOs Engaged', value: stats.ngosEngaged || 0, color: '#3d5a99' },
          { label: 'Beneficiaries Impacted', value: (stats.beneficiariesImpacted || 0).toLocaleString(), color: '#4a6fbf' },
          { label: 'Avg Feedback', value: stats.avgFeedback ? `${stats.avgFeedback}/5` : '-', color: '#6366f1' },
        ].map(k => (
          <div key={k.label} className="border border-gray-100 rounded-xl p-5 bg-white shadow-sm flex flex-col justify-center">
            <p className="text-3xl font-bold mb-1" style={{ color: k.color }}>{k.value}</p>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Chart 1 */}
        <div className="border border-gray-100 rounded-2xl bg-white shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-6">Monthly Participation (Hours)</h2>
          <div className="h-64">
            {monthly && monthly.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="hours" fill="#0d3b26" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No data available</div>
            )}
          </div>
        </div>

        {/* Chart 2 */}
        <div className="border border-gray-100 rounded-2xl bg-white shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-6">Employee Engagement Trend</h2>
          <div className="h-64">
            {monthly && monthly.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey="count" stroke="#2e7d52" strokeWidth={3} dot={{ r: 4, fill: '#2e7d52', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/dashboard/team/generate')}
            className="group border border-gray-100 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-[#0d3b26] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Generate Logins</p>
              <p className="text-xs text-gray-500">Add more team members</p>
            </div>
          </button>
          
          <button
            onClick={() => router.push('/dashboard/team')}
            className="group border border-gray-100 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-[#1a5c3a] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <UsersRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">View Team</p>
              <p className="text-xs text-gray-500">Manage your volunteers</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/events')}
            className="group border border-gray-100 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-[#2e7d52] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Upcoming Events</p>
              <p className="text-xs text-gray-500">Discover and mark attendance</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
