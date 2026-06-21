'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/authStore';
import { logout } from '@/app/actions';
import { toast } from 'sonner';
import { LogOut, Menu, X, LayoutDashboard, CalendarDays, Users, FileText, Building2, ChevronDown } from 'lucide-react';

const Navbar = () => {
  const { user, clearAuth, isAuthenticated, isAdmin } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  const isOrgUser = user?.role === 'org_spoc' || user?.role === 'org_member';

  const handleLogout = async () => {
    try {
      await logout();
      clearAuth();
      toast.success('Logged out successfully');
      startTransition(() => router.push('/'));
    } catch {
      toast.error('Logout failed');
    }
  };

  if (!mounted) return null;
  if (pathname === '/login') return null;
  if (pathname === '/') return null;
  if (!isAuthenticated()) return null;

  // Build nav links based on role
  const navLinks = [];
  if (isAdmin()) {
    navLinks.push({ label: 'Dashboard', href: '/admin', icon: LayoutDashboard, startsWith: true });
    navLinks.push({ label: 'Events', href: '/admin/events', icon: CalendarDays });
    navLinks.push({ label: 'Corporate', href: '/admin/corporate', icon: Building2 });
    navLinks.push({ label: 'Users', href: '/admin/users', icon: Users });
    navLinks.push({ label: 'Registrations', href: '/admin/registrations', icon: Users });
  } else if (user?.role === 'org_spoc') {
    navLinks.push({ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard });
    navLinks.push({ label: 'My Team', href: '/dashboard/team', icon: Users });
    navLinks.push({ label: 'Events', href: '/events', icon: CalendarDays });
    navLinks.push({ label: 'Registrations', href: '/dashboard/registrations', icon: Users });
    navLinks.push({ label: 'NGO Partners', href: '/ngo-partners', icon: Building2 });
  } else if (user?.role === 'org_member' || user?.role === 'volunteer') {
    navLinks.push({ label: 'My Impact', href: '/dashboard/my-impact', icon: LayoutDashboard });
    navLinks.push({ label: 'Events', href: '/events', icon: CalendarDays });
  } else if (user?.role === 'ngo') {
    navLinks.push({ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard });
    navLinks.push({ label: 'Events', href: '/events', icon: CalendarDays });
    navLinks.push({ label: 'Registrations', href: '/dashboard/registrations', icon: Users });
    navLinks.push({ label: 'Reports', href: '/reports', icon: FileText });
    navLinks.push({ label: 'Documents', href: '/dashboard/documents', icon: FileText });
  }

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 1px 0 0 rgba(0,0,0,0.06)',
        }}
      >
        {/* Progress bar when navigating */}
        {isPending && (
          <div className="absolute top-0 left-0 h-[2px] bg-emerald-500 animate-pulse w-full" />
        )}

        <nav className="max-w-[1200px] mx-auto px-5 h-[60px] flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src="/kindera-logo.svg"
              alt="Kindera"
              width={110}
              height={36}
              className="object-contain"
            />
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = link.startsWith
                ? pathname.startsWith(link.href)
                : pathname === link.href || pathname.startsWith(link.href + '/');
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-[#0d3b26]/8 text-[#0d3b26]'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#0d3b26] rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right: User info + Logout */}
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right">
              <p className="text-[13px] font-semibold text-gray-900 leading-none">{user?.name}</p>
              <p className="text-[11px] text-gray-400 capitalize mt-0.5">{user?.role?.replace(/_/g, ' ')}</p>
            </div>
            <div className="w-[1px] h-5 bg-gray-200 mx-1" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-5 h-5 text-gray-700" /> : <Menu className="w-5 h-5 text-gray-700" />}
          </button>
        </nav>
      </header>

      {/* Spacer so content doesn't hide under fixed header */}
      <div className="h-[60px]" />

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-40 bg-white flex flex-col pt-[60px]" onClick={() => setIsMenuOpen(false)}>
          <div className="flex flex-col p-4 gap-1" onClick={e => e.stopPropagation()}>
            {navLinks.map((link) => {
              const isActive = link.startsWith
                ? pathname.startsWith(link.href)
                : pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-colors ${
                    isActive
                      ? 'bg-[#0d3b26]/8 text-[#0d3b26]'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </Link>
              );
            })}

            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="px-4 mb-3">
                <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-400 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
              </div>
              <button
                onClick={() => { setIsMenuOpen(false); handleLogout(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;