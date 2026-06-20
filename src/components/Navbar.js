'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { logout } from '@/app/actions';
import { toast } from 'sonner';
import { Menu, X, LogOut } from 'lucide-react';

const NavLink = ({ href, children, pathname, onClick, startsWith = false }) => {
  const isActive = startsWith ? pathname.startsWith(href) : pathname === href;

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`relative py-1 text-sm font-medium transition-colors duration-150
        after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:transition-all after:duration-150
        ${isActive
          ? 'text-white after:bg-emerald-400'
          : 'text-slate-300 hover:text-white after:bg-transparent hover:after:bg-slate-500'
        }`}
    >
      {children}
    </Link>
  );
};

const Navbar = () => {
  const { user, clearAuth, isAuthenticated, isAdmin } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setMounted(true), []);

  const isOrgUser = user?.role === 'org_spoc' || user?.role === 'org_member';

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

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
  if (!isAuthenticated()) return null;
  if (pathname === '/') return null;

  return (
    <nav className="bg-[#0d3b26] text-white shadow-md relative z-10">
      {/* Top progress line when navigating */}
      {isPending && (
        <div className="absolute top-0 left-0 h-0.5 bg-emerald-400 animate-pulse w-full" />
      )}

      <div className="container mx-auto px-4 flex flex-wrap justify-between items-center h-14">

        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image src="/mylogo.jpeg" alt="Kindera" width={110} height={36} className="object-contain" />
        </Link>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-white/10 focus:outline-none transition-colors"
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Nav links + user info */}
        <div
          className={`${
            isMenuOpen ? 'flex' : 'hidden'
          } md:flex flex-col md:flex-row w-full md:w-auto mt-3 md:mt-0 pb-4 md:pb-0 gap-5 md:gap-6 border-t border-white/10 md:border-0 pt-3 md:pt-0`}
        >
          {/* Links */}
          <div className="flex flex-col md:flex-row gap-4 md:gap-5 md:items-center">
            {isOrgUser && (
              <NavLink href="/" pathname={pathname} onClick={closeMenu}>Home</NavLink>
            )}
            {isOrgUser && (
              <NavLink href="/ngo-partners" pathname={pathname} onClick={closeMenu}>NGO Partners</NavLink>
            )}
            <NavLink href="/events" pathname={pathname} onClick={closeMenu}>Events</NavLink>

            {user?.role === 'org_spoc' && (
              <NavLink href="/dashboard/team" pathname={pathname} onClick={closeMenu}>My Team</NavLink>
            )}
            {user?.role === 'ngo' && (
              <NavLink href="/dashboard/documents" pathname={pathname} onClick={closeMenu}>Documents</NavLink>
            )}

            {!isAdmin() && isAuthenticated() && (
              <NavLink href="/dashboard" pathname={pathname} onClick={closeMenu}>Dashboard</NavLink>
            )}

            {isAdmin() && (
              <NavLink href="/admin" pathname={pathname} onClick={closeMenu} startsWith>
                Admin Dashboard
              </NavLink>
            )}
          </div>

          {/* Divider + user */}
          <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-0 border-white/10 md:pl-4 md:border-l md:border-white/20">
            <div className="text-xs text-slate-300 leading-tight">
              <p className="font-medium text-white">{user?.name}</p>
              <p className="capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-300 hover:text-white hover:bg-white/10 gap-1.5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;