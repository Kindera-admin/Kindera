'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { Users, CalendarDays, UserPlus, Building2, ArrowRight, Loader2, FileText, BarChart3 } from 'lucide-react';

const cards = [
  {
    title: 'Manage Events',
    description: 'Add, view or delete upcoming events shown on the homepage.',
    icon: CalendarDays,
    href: '/admin/events',
    accent: '#0d3b26',
    gradient: 'from-[#0d3b26] to-[#1a5c3a]',
    lightBg: '#f0f7f3',
  },
  {
    title: 'Impact Dashboard',
    description: 'Analytics, monthly stats, top organizations and CSR ROI data.',
    icon: BarChart3,
    href: '/admin/impact',
    accent: '#3b82f6',
    gradient: 'from-[#3b82f6] to-[#60a5fa]',
    lightBg: '#eff6ff',
  },
  {
    title: 'Corporate Overview',
    description: 'View KPIs for all registered corporate volunteer organisations.',
    icon: Building2,
    href: '/admin/corporate',
    accent: '#1a5c3a',
    gradient: 'from-[#1a5c3a] to-[#2e7d52]',
    lightBg: '#f0f7f3',
  },
  {
    title: 'NGO Documents',
    description: 'Review and verify certificates uploaded by NGO partners.',
    icon: FileText,
    href: '/admin/ngo-documents',
    accent: '#2e7d52',
    gradient: 'from-[#2e7d52] to-[#3a9e68]',
    lightBg: '#f0f7f3',
  },
  {
    title: 'Manage Users',
    description: 'View all registered users and manage their access and roles.',
    icon: Users,
    href: '/admin/users',
    accent: '#3d5a99',
    gradient: 'from-[#3d5a99] to-[#4a6fbf]',
    lightBg: '#f0f5ff',
  },
  {
    title: 'Register User',
    description: 'Manually register a new user into the Kindera platform.',
    icon: UserPlus,
    href: '/admin/register',
    accent: '#6366f1',
    gradient: 'from-[#6366f1] to-[#818cf8]',
    lightBg: '#f5f3ff',
  },
  {
    title: 'NGO Partners',
    description: 'Add or remove NGO partners displayed to platform users.',
    icon: Building2,
    href: '/admin/ngo-partners',
    accent: '#8b5cf6',
    gradient: 'from-[#8b5cf6] to-[#a78bfa]',
    lightBg: '#faf5ff',
  },
  {
    title: 'Manage Impact Photos',
    description: 'Add or remove impact photos shown in the homepage gallery.',
    icon: CalendarDays,
    href: '/admin/impact-photos',
    accent: '#f59e0b',
    gradient: 'from-[#f59e0b] to-[#fbbf24]',
    lightBg: '#fffbeb',
  },
  {
    title: 'Messages',
    description: 'Securely chat with NGO partners and Corporate SPOCs, share docs and reports.',
    icon: FileText,
    href: '/messages',
    accent: '#e11d48',
    gradient: 'from-[#e11d48] to-[#fb7185]',
    lightBg: '#fff1f2',
  },
];

export default function DashboardClient({ userRole }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeCard, setActiveCard] = useState(null);

  const handleNavigate = (href, title) => {
    setActiveCard(title);
    startTransition(() => {
      router.push(href);
    });
  };

  const visibleCards = userRole === 'employee'
    ? cards.filter((card) => card.href === '/admin/ngo-partners')
    : cards;

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">
          Control Centre
        </p>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">
          {userRole === 'employee' ? 'Employee Dashboard' : 'Admin Dashboard'}
        </h1>
        <p className="text-gray-500 text-sm">
          {userRole === 'employee' ? 'Manage NGO partners.' : 'Manage the Kindera platform — users, events, and NGO partners.'}
        </p>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {visibleCards.map((card) => {
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
  );
}
