'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Users, Clock, CalendarDays, Building2, Plus, UsersRound, MessageSquare, ClipboardList, PlusCircle, ClipboardCheck, FileText, Settings, ArrowRight, Loader2 } from 'lucide-react';

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

const actionCards = [
  {
    title: 'Generate Logins',
    description: 'Add more team members',
    icon: Plus,
    href: '/dashboard/team/generate',
    accent: '#0d3b26',
    gradient: 'from-[#0d3b26] to-[#1a5c3a]',
  },
  {
    title: 'View Team',
    description: 'Manage your volunteers',
    icon: UsersRound,
    href: '/dashboard/team',
    accent: '#1a5c3a',
    gradient: 'from-[#1a5c3a] to-[#2e7d52]',
  },
  {
    title: 'Upcoming Events',
    description: 'Browse all events',
    icon: CalendarDays,
    href: '/events',
    accent: '#2e7d52',
    gradient: 'from-[#2e7d52] to-[#3a9e68]',
  },
  {
    title: 'Event History',
    description: 'View past participation',
    icon: FileText,
    href: '/dashboard/events-history',
    accent: '#3d5a99',
    gradient: 'from-[#3d5a99] to-[#4a6fbf]',
  },
  {
    title: 'Mark Attendance',
    description: 'Record team attendance for events',
    icon: ClipboardCheck,
    href: '/dashboard/attendance',
    accent: '#0d7490',
    gradient: 'from-[#0d7490] to-[#0891b2]',
  },
  {
    title: 'Create Event',
    description: 'Create a new event for your team',
    icon: PlusCircle,
    href: '/events/create',
    accent: '#6366f1',
    gradient: 'from-[#6366f1] to-[#818cf8]',
  },
  {
    title: 'Messages',
    description: 'Chat with Admin and your team',
    icon: MessageSquare,
    href: '/messages',
    accent: '#e11d48',
    gradient: 'from-[#e11d48] to-[#fb7185]',
  },
  {
    title: 'Settings & Branding',
    description: 'Update profile and corporate logo',
    icon: Settings,
    href: '/settings',
    accent: '#4b5563',
    gradient: 'from-[#4b5563] to-[#6b7280]',
  }
];

export default function CorporateDashboardClient({ stats, monthly, quarterly, selectedYear }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeCard, setActiveCard] = useState(null);

  const handleNavigate = (href, title) => {
    setActiveCard(title);
    startTransition(() => {
      router.push(href);
    });
  };

  const handleYearChange = (e) => {
    router.push(`/dashboard?year=${e.target.value}`);
  };

  const currentYear = new Date().getFullYear();
  const startYear = 2026;
  const years = Array.from({ length: currentYear - startYear + 1 }, (_, i) => currentYear - i);

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">SPOC Dashboard</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Team Overview</h1>
          <p className="text-gray-500 text-sm">Live KPIs for your corporate volunteer programme.</p>
        </div>
        <div>
          <select 
            value={selectedYear || currentYear} 
            onChange={handleYearChange}
            className="border-gray-200 border rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {years.map(y => (
              <option key={y} value={y}>{y} Impact Report</option>
            ))}
          </select>
        </div>
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
        {/* Chart 1: Quarterly */}
        <div className="border border-gray-100 rounded-2xl bg-white shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-6">Quarterly CSR Performance ({selectedYear || currentYear})</h2>
          <div className="h-64">
            {quarterly && quarterly.some(q => q.hours > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quarterly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="quarter" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="hours" fill="#0d3b26" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No quarterly data yet for {selectedYear || currentYear}.</div>
            )}
          </div>
        </div>

        {/* Chart 2: Monthly Trend */}
        <div className="border border-gray-100 rounded-2xl bg-white shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-6">Monthly Engagement Trend ({selectedYear || currentYear})</h2>
          <div className="h-64">
            {monthly && monthly.some(m => m.count > 0) ? (
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
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No monthly data yet for {selectedYear || currentYear}.</div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {actionCards.map((card) => {
            const Icon = card.icon;
            const isLoading = isPending && activeCard === card.title;

            return (
              <button
                key={card.title}
                onClick={() => handleNavigate(card.href, card.title)}
                disabled={isPending}
                className="group relative text-left border border-gray-100 rounded-2xl p-6 bg-white shadow-sm
                           hover:shadow-xl hover:-translate-y-1 transition-all duration-200
                           focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0d3b26]
                           disabled:cursor-not-allowed overflow-hidden"
              >
                {/* Top accent bar */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.gradient} 
                              opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
                />

                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-200 group-hover:scale-105"
                  style={{ background: card.accent }}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5 text-white" />
                  )}
                </div>

                {/* Content */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 mb-1">
                      {isLoading ? 'Loading…' : card.title}
                    </h2>
                    <p className="text-sm text-gray-500 leading-relaxed">{card.description}</p>
                  </div>
                  <ArrowRight
                    className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5 group-hover:text-gray-500 
                               group-hover:translate-x-0.5 transition-all duration-200"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
