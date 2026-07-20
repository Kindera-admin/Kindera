'use client';

import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Users, Clock, CalendarDays, Building2, Plus, UsersRound, MessageSquare, ClipboardList, PlusCircle, ClipboardCheck, FileText } from 'lucide-react';

// Dynamically import recharts to avoid SSR crash
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });

export default function CorporateDashboardClient({ stats, monthly }) {
  const router = useRouter();

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">SPOC Dashboard</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Team Overview</h1>
        <p className="text-gray-500 text-sm">Live KPIs for your corporate volunteer programme.</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Volunteers', value: stats.totalVolunteers || 0, color: '#0d3b26', icon: Users },
          { label: 'Volunteer Hours', value: (stats.volunteerHours || 0).toLocaleString(), color: '#1a5c3a', icon: Clock },
          { label: 'Events Attended', value: stats.eventsAttended || 0, color: '#2e7d52', icon: CalendarDays },
          { label: 'NGOs Engaged', value: stats.ngosEngaged || 0, color: '#3d5a99', icon: Building2 },
          { label: 'Avg Feedback', value: stats.avgFeedback ? `${stats.avgFeedback}/5` : '–', color: '#6366f1', icon: null },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="border border-gray-100 rounded-xl p-5 bg-white shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{k.label}</p>
                {Icon && <Icon className="w-4 h-4 text-gray-300" />}
              </div>
              <p className="text-3xl font-bold" style={{ color: k.color }}>{k.value}</p>
            </div>
          );
        })}
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
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No data yet — hours will appear once your team logs attendance.</div>
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
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No data yet.</div>
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
              <p className="text-xs text-gray-500">Browse all events</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/dashboard/events-history')}
            className="group border border-gray-100 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-[#3d5a99] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Event History</p>
              <p className="text-xs text-gray-500">View past participation</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/dashboard/attendance')}
            className="group border border-gray-100 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-[#0d7490] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <ClipboardCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Mark Attendance</p>
              <p className="text-xs text-gray-500">Record team attendance for events</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/events/create')}
            className="group border border-gray-100 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-[#3d5a99] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <PlusCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Create Event</p>
              <p className="text-xs text-gray-500">Create a new event for your team</p>
            </div>
          </button>


          <button
            onClick={() => router.push('/messages')}
            className="group border border-gray-100 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-[#e11d48] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Messages</p>
              <p className="text-xs text-gray-500">Chat with Admin and your team</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
