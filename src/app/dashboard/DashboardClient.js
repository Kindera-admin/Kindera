'use client';

import { useRouter } from 'next/navigation';
import { Users, CalendarDays, UserPlus } from 'lucide-react';

const cards = [
  {
    title: 'Manage Events',
    description: 'Add, view or delete upcoming events shown on the homepage.',
    icon: CalendarDays,
    href: '/admin/events',
    color: '#0d3b26',
  },
  {
    title: 'Manage Users',
    description: 'View all registered users and manage their access.',
    icon: Users,
    href: '/admin/users',
    color: '#1a5c3a',
  },
  {
    title: 'Register User',
    description: 'Manually register a new user into the platform.',
    icon: UserPlus,
    href: '/admin/register',
    color: '#2e7d52',
  },
];

export default function DashboardClient() {
  const router = useRouter();

  return (
    <div className="w-full max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Admin Dashboard</h1>
      <p className="text-gray-500 mb-8 text-sm">Manage the Kindera platform from here.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              onClick={() => card.external ? window.open(card.href, '_blank') : router.push(card.href)}
              className="cursor-pointer border rounded-xl p-6 hover:shadow-md transition-all hover:-translate-y-1 bg-white"
            >
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center mb-4"
                style={{ background: card.color }}
              >
                <Icon className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold mb-1">{card.title}</h2>
              <p className="text-sm text-gray-500">{card.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
