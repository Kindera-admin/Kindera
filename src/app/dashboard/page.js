import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import HomeButtons from '@/components/HomeButtons';
import { getEvents, getOrgStats } from '@/app/actions';
import { CalendarDays, MapPin, FileText, Users, Building2, ArrowRight } from 'lucide-react';
import CorporateDashboardClient from './CorporateDashboardClient';
import NameUpdateClient from './NameUpdateClient';

const ROLE_LABELS = {
  ngo: 'NGO Representative',
  org_spoc: 'Organisation SPOC',
  org_member: 'Organisation Member',
};

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // If the user was bulk-generated and needs to update their name
  if (user.requiresNameUpdate) {
    return <NameUpdateClient currentName={user.name} />;
  }

  if (user.role === 'admin') {
    redirect('/admin');
  }

  if (user.role === 'org_member') {
    redirect('/dashboard/my-impact');
  }

  if (user.role === 'org_spoc') {
    const { stats = {}, monthly = [] } = await getOrgStats(user.organizationName);
    return <CorporateDashboardClient stats={stats} monthly={monthly} />;
  }

  const eventsResult = await getEvents('upcoming');
  const events = eventsResult.success ? eventsResult.events.slice(0, 3) : [];

  const isOrgUser = user.role === 'org_spoc' || user.role === 'org_member';

  // Define action cards per role
  const actionCards = [
    user.role === 'ngo' && {
      title: 'Submit Monthly Report',
      description: 'Submit data about people helped, events conducted, and funds utilized.',
      icon: FileText,
      color: '#0d3b26',
      href: '/reports/submit',
      label: 'Submit Report',
    },
    user.role === 'ngo' && {
      title: 'View Reports',
      description: 'Review your previously submitted monthly impact reports.',
      icon: FileText,
      color: '#1a5c3a',
      href: '/reports',
      label: 'View Reports',
    },
    (user.role === 'ngo' || isOrgUser) && {
      title: 'Events',
      description: isOrgUser
        ? 'Discover upcoming events and register through provided links.'
        : 'Create and manage events for your organisation.',
      icon: CalendarDays,
      color: '#2e7d52',
      href: '/events',
      label: 'View Events',
    },
    isOrgUser && {
      title: 'NGO Partners',
      description: 'Learn about the NGOs we collaborate with and their impactful work.',
      icon: Building2,
      color: '#3d5a99',
      href: '/ngo-partners',
      label: 'View Partners',
    },
  ].filter(Boolean);

  return (
    <div className="w-full max-w-4xl mx-auto">

      {/* Welcome Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">
          {ROLE_LABELS[user.role] || user.role}
        </p>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user.name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Here&apos;s what&apos;s happening on the Kindera platform today.
        </p>
      </div>

      {/* Upcoming Events (for org users) */}
      {isOrgUser && events.length > 0 && (
        <div className="mb-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#2e7d52]" />
              Upcoming Events
            </h2>
            <HomeButtons route="/events" label="View All" />
          </div>
          <div className="grid grid-cols-1 gap-3">
            {events.map((event) => (
              <div
                key={event._id}
                className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow flex gap-4"
              >
                {/* Color bar */}
                <div className="w-1 rounded-full bg-[#2e7d52] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{event.title}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {new Date(event.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                    {event.location && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1.5 line-clamp-1">{event.description}</p>
                </div>
                {event.registrationLink && (
                  <a
                    href={event.registrationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 self-center text-xs font-semibold text-[#0d3b26] 
                               hover:text-[#2e7d52] flex items-center gap-1 transition-colors"
                  >
                    Register
                    <ArrowRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Cards */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {actionCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="group border border-gray-100 rounded-2xl p-5 bg-white shadow-sm
                           hover:shadow-lg hover:-translate-y-1 transition-all duration-200 relative overflow-hidden"
              >
                {/* Top accent bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ background: card.color }}
                />
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-105"
                  style={{ background: card.color }}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">{card.title}</h3>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{card.description}</p>
                <HomeButtons route={card.href} label={card.label} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
