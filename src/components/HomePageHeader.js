'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import useAuthStore from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { logout } from '@/app/actions';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function HomePageHeader() {
  const { user, clearAuth, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const isLoggedIn = isAuthenticated();
  const isOrgUser = user?.role === 'org_spoc' || user?.role === 'org_member';
  const isAdmin = user?.role === 'admin';
  const isNGO = user?.role === 'ngo';

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      clearAuth();
      toast.success('Logged out successfully');
      router.push('/login');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  const navLinks = [
    { label: 'About Us', href: '#about' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Gallery', href: '#gallery' },
    { label: 'Events', href: '#events' },
  ];

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(12px)',
          boxShadow: scrolled ? '0 4px 24px -4px rgba(0,0,0,0.06)' : 'none',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
        }}
      >
        <nav className="max-w-[1200px] mx-auto px-5 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <motion.div whileHover={{ scale: 1.05 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }}>
              <Image 
                src="/kindera-logo.png" 
                alt="Kindera" 
                width={130} 
                height={42} 
                className="object-contain" 
              />
            </motion.div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="relative text-[14px] font-medium tracking-wide transition-colors duration-300 group"
                style={{
                  fontFamily: "'General Sans', sans-serif",
                  color: '#2c2c2c',
                }}
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 h-[1.5px] w-0 bg-emerald-400 transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:w-full" />
              </a>
            ))}

            <div className="w-[1px] h-4 bg-gray-300" />

            {/* Auth Buttons */}
            {mounted && isLoggedIn ? (
              <div className="flex items-center gap-6">
                {(isAdmin || isNGO || isOrgUser) && (
                  <Link
                    href={isAdmin ? "/admin" : "/dashboard"}
                    className="relative text-[14px] font-medium tracking-wide transition-colors duration-300 group"
                    style={{ color: '#2c2c2c' }}
                  >
                    Dashboard
                    <span className="absolute -bottom-1 left-0 h-[1.5px] w-0 bg-emerald-400 transition-all duration-300 ease-out group-hover:w-full" />
                  </Link>
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  className="px-5 py-2 rounded-full text-[13px] font-semibold transition-colors border-none"
                  style={{ 
                    fontFamily: "'General Sans', sans-serif", 
                    background: '#dc2626', 
                    color: '#fff',
                  }}
                >
                  Logout
                </motion.button>
              </div>
            ) : (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/login"
                  className="px-6 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-300 hover:shadow-lg"
                  style={{ 
                    fontFamily: "'General Sans', sans-serif", 
                    background: '#0d3b26', 
                    color: '#fff' 
                  }}
                >
                  Login
                </Link>
              </motion.div>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button
            className="md:hidden flex flex-col gap-[5px] bg-transparent border-none cursor-pointer p-2 z-50"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block w-6 h-[2px] rounded-sm transition-all duration-300"
                style={{
                  background: '#1a1a1a',
                  transform: menuOpen
                    ? i === 0 ? 'rotate(45deg) translate(5px, 5px)' 
                    : i === 1 ? 'scaleX(0)' 
                    : 'rotate(-45deg) translate(5px, -5px)'
                    : 'none',
                  opacity: menuOpen && i === 1 ? 0 : 1,
                }}
              />
            ))}
          </button>
        </nav>
      </motion.header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-white/95 backdrop-blur-xl"
          >
            {navLinks.map((link, i) => (
              <motion.a
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="text-gray-900 text-3xl font-bold tracking-tight hover:text-emerald-600 transition-colors"
              >
                {link.label}
              </motion.a>
            ))}

            {mounted && isLoggedIn ? (
              <>
                {(isAdmin || isNGO || isOrgUser) && (
                  <motion.a
                    href={isAdmin ? "/admin" : "/dashboard"}
                    onClick={() => setMenuOpen(false)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: navLinks.length * 0.1 }}
                    className="text-gray-900 text-3xl font-bold tracking-tight hover:text-emerald-600 transition-colors"
                  >
                    Dashboard
                  </motion.a>
                )}
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (navLinks.length + 1) * 0.1 }}
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="mt-8 px-8 py-3 rounded-full text-lg font-semibold bg-red-600 text-white"
                >
                  Logout
                </motion.button>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: navLinks.length * 0.1 }}
              >
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="mt-4 px-10 py-4 rounded-full text-lg font-semibold bg-[#0d3b26] text-white"
                >
                  Login
                </Link>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}