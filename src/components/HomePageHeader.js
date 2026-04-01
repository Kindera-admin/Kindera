'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import useAuthStore from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { logout } from '@/app/actions';
import { toast } from 'sonner';

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
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
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
    { label: 'Contact', href: '#contact' },
  ];

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=General+Sans:wght@400;500;600;700&display=swap');
      `}</style>

      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
        style={{
          background: scrolled
            ? 'rgba(255,255,255,0.92)'
            : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          boxShadow: scrolled ? '0 1px 0 rgba(0,0,0,0.06)' : 'none',
        }}
      >
        <nav className="max-w-[1200px] mx-auto px-5 py-4 flex items-center justify-between">
          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2.5 no-underline group">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-400"
              style={{
                background: scrolled ? '#0d3b26' : '#2ecc71',
                color: scrolled ? '#fff' : '#0d3b26',
              }}
            >
              <span
                style={{
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: '1.35rem',
                  fontStyle: 'italic',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}
              >
                K
              </span>
            </div>
            <span
              className="text-[22px] transition-colors duration-400"
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                color: scrolled ? '#0d3b26' : '#fff',
              }}
            >
              Kindera
            </span>
          </Link>

          {/* ── Desktop Nav ── */}
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="relative text-[14px] font-medium tracking-wide no-underline transition-colors duration-300 group"
                style={{
                  fontFamily: "'General Sans', sans-serif",
                  color: scrolled ? '#2c2c2c' : 'rgba(255,255,255,0.85)',
                }}
              >
                {link.label}
                <span
                  className="absolute bottom-[-4px] left-0 h-[1.5px] w-0 transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:w-full"
                  style={{ background: scrolled ? '#0d3b26' : '#2ecc71' }}
                />
              </a>
            ))}

            {/* Auth-aware buttons */}
            {mounted && isLoggedIn ? (
              <>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="relative text-[14px] font-medium tracking-wide no-underline transition-colors duration-300 group"
                    style={{ fontFamily: "'General Sans', sans-serif", color: scrolled ? '#2c2c2c' : 'rgba(255,255,255,0.85)' }}
                  >
                    Admin Dashboard
                    <span className="absolute bottom-[-4px] left-0 h-[1.5px] w-0 transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:w-full" style={{ background: scrolled ? '#0d3b26' : '#2ecc71' }} />
                  </Link>
                )}
                {isNGO && (
                  <Link
                    href="/dashboard"
                    className="relative text-[14px] font-medium tracking-wide no-underline transition-colors duration-300 group"
                    style={{ fontFamily: "'General Sans', sans-serif", color: scrolled ? '#2c2c2c' : 'rgba(255,255,255,0.85)' }}
                  >
                    Dashboard
                    <span className="absolute bottom-[-4px] left-0 h-[1.5px] w-0 transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:w-full" style={{ background: scrolled ? '#0d3b26' : '#2ecc71' }} />
                  </Link>
                )}
                {isOrgUser && (
                  <>
                    <Link
                      href="/dashboard"
                      className="relative text-[14px] font-medium tracking-wide no-underline transition-colors duration-300 group"
                      style={{ fontFamily: "'General Sans', sans-serif", color: scrolled ? '#2c2c2c' : 'rgba(255,255,255,0.85)' }}
                    >
                      Dashboard
                      <span className="absolute bottom-[-4px] left-0 h-[1.5px] w-0 transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:w-full" style={{ background: scrolled ? '#0d3b26' : '#2ecc71' }} />
                    </Link>
                    <Link
                      href="/ngo-partners"
                      className="relative text-[14px] font-medium tracking-wide no-underline transition-colors duration-300 group"
                      style={{ fontFamily: "'General Sans', sans-serif", color: scrolled ? '#2c2c2c' : 'rgba(255,255,255,0.85)' }}
                    >
                      NGO Partners
                      <span className="absolute bottom-[-4px] left-0 h-[1.5px] w-0 transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:w-full" style={{ background: scrolled ? '#0d3b26' : '#2ecc71' }} />
                    </Link>
                  </>
                )}
                <button
                  onClick={handleLogout}
                  className="px-5 py-2 rounded-full text-[13px] font-semibold border-none cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
                  style={{ fontFamily: "'General Sans', sans-serif", background: scrolled ? '#dc2626' : 'rgba(220,38,38,0.9)', color: '#fff' }}
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-6 py-2.5 rounded-full text-[13px] font-semibold no-underline transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                style={{ fontFamily: "'General Sans', sans-serif", background: scrolled ? '#0d3b26' : '#2ecc71', color: scrolled ? '#fff' : '#0d3b26' }}
              >
                Login
              </Link>
            )}
          </div>

          {/* ── Mobile Hamburger ── */}
          <button
            className="md:hidden flex flex-col gap-[5px] bg-transparent border-none cursor-pointer p-1"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block w-6 h-[2px] rounded-sm transition-all duration-300"
                style={{
                  background: scrolled ? '#1a1a1a' : '#fff',
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
      </header>

      {/* ── Mobile Menu Overlay ── */}
      <div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-8 transition-all duration-500"
        style={{
          background: 'rgba(13,59,38,0.97)',
          backdropFilter: 'blur(20px)',
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? 'auto' : 'none',
          transform: menuOpen ? 'none' : 'translateY(-20px)',
        }}
      >
        <button
          onClick={() => setMenuOpen(false)}
          className="absolute top-6 right-6 bg-transparent border-none text-white text-3xl cursor-pointer hover:opacity-70 transition-opacity"
          aria-label="Close menu"
        >
          ×
        </button>

        {navLinks.map((link, i) => (
          <a
            key={link.label}
            href={link.href}
            onClick={() => setMenuOpen(false)}
            className="text-white no-underline text-2xl font-semibold opacity-80 hover:opacity-100 transition-all duration-300"
            style={{
              fontFamily: "'General Sans', sans-serif",
              transitionDelay: menuOpen ? `${i * 60}ms` : '0ms',
              transform: menuOpen ? 'none' : 'translateY(10px)',
            }}
          >
            {link.label}
          </a>
        ))}

        {mounted && isLoggedIn ? (
          <>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="text-white no-underline text-2xl font-semibold opacity-80 hover:opacity-100 transition-opacity"
                style={{ fontFamily: "'General Sans', sans-serif" }}
              >
                Admin Dashboard
              </Link>
            )}
            {(isNGO || isOrgUser) && (
              <Link
                href="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="text-white no-underline text-2xl font-semibold opacity-80 hover:opacity-100 transition-opacity"
                style={{ fontFamily: "'General Sans', sans-serif" }}
              >
                Dashboard
              </Link>
            )}
            {isOrgUser && (
              <Link
                href="/ngo-partners"
                onClick={() => setMenuOpen(false)}
                className="text-white no-underline text-2xl font-semibold opacity-80 hover:opacity-100 transition-opacity"
                style={{ fontFamily: "'General Sans', sans-serif" }}
              >
                NGO Partners
              </Link>
            )}
            <button
              onClick={() => { setMenuOpen(false); handleLogout(); }}
              className="mt-4 px-8 py-3 rounded-full text-base font-semibold border-none cursor-pointer bg-red-600 text-white hover:bg-red-700 transition-colors"
              style={{ fontFamily: "'General Sans', sans-serif" }}
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            href="/login"
            onClick={() => setMenuOpen(false)}
            className="mt-4 px-8 py-3 rounded-full text-base font-semibold no-underline transition-all duration-300 hover:-translate-y-0.5"
            style={{ fontFamily: "'General Sans', sans-serif", background: '#2ecc71', color: '#0d3b26' }}
          >
            Login
          </Link>
        )}
      </div>
    </>
  );
}