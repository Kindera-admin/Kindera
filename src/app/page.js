import Link from "next/link";
import HomePageHeader from "@/components/HomePageHeader";
import { getHomeEvents } from "@/app/actions";

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { events: upcomingEvents = [] } = await getHomeEvents();

  const steps = [
    { num: "01", title: "Client Outreach", desc: "Corporate partners reach out with focus areas for volunteering." },
    { num: "02", title: "Project Mapping", desc: "We design initiatives, mapping suitable non-profit partners and communities." },
    { num: "03", title: "Organization & Execution", desc: "Kindera organizes and hosts the volunteering event end to end." },
    { num: "04", title: "Completion & Delivery", desc: "We deliver volunteer outputs and assets to beneficiaries." },
    { num: "05", title: "Reporting & Feedback", desc: "Impact reports delivered to corporates and volunteers." },
  ];

  const stats = [
    { value: "100+", label: "NGOs Registered" },
    { value: "100,000+", label: "People Helped" },
    { value: "1000+", label: "Events Conducted" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=General+Sans:wght@400;500;600;700&display=swap');

        :root {
          --forest: #0d3b26;
          --forest-mid: #1a5c3a;
          --emerald: #2ecc71;
          --sage: #a8c5b8;
          --cream: #f7f5f0;
          --warm-white: #fefdfb;
          --charcoal: #1a1a1a;
          --text-primary: #2c2c2c;
          --text-secondary: #6b6b6b;
          --gold: #c9a84c;
        }

        .serif { font-family: 'DM Serif Display', Georgia, serif; }
        .sans { font-family: 'General Sans', -apple-system, sans-serif; }

        /* ── Grain overlay ── */
        .grain::before {
          content: '';
          position: fixed; inset: 0;
          opacity: 0.025;
          pointer-events: none;
          z-index: 9999;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        /* ── Scroll-triggered animations ── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideRight {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .anim-fade-up {
          animation: fadeUp 0.7s cubic-bezier(.22,1,.36,1) both;
        }
        .anim-fade-in {
          animation: fadeIn 0.6s ease both;
        }
        .anim-scale-in {
          animation: scaleIn 0.6s cubic-bezier(.22,1,.36,1) both;
        }
        .anim-slide-right {
          animation: slideRight 0.6s cubic-bezier(.22,1,.36,1) both;
        }

        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }
        .delay-4 { animation-delay: 0.4s; }
        .delay-5 { animation-delay: 0.5s; }
        .delay-6 { animation-delay: 0.6s; }
        .delay-7 { animation-delay: 0.7s; }
        .delay-8 { animation-delay: 0.8s; }

        /* ── Hero ── */
        .hero {
          min-height: 100vh;
          display: flex;
          align-items: center;
          position: relative;
          background: var(--forest);
          overflow: hidden;
        }
        .hero-bg {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 70% 40%, rgba(46,204,113,0.12) 0%, transparent 70%),
            radial-gradient(ellipse 50% 50% at 20% 80%, rgba(201,168,76,0.08) 0%, transparent 60%);
        }
        .hero-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 80px 80px;
        }
        .hero-circle-1 {
          position: absolute; right: 8%; top: 28%;
          width: 320px; height: 320px; border-radius: 50%;
          border: 1px solid rgba(46,204,113,0.15);
          animation: fadeIn 1.5s ease 0.5s both;
        }
        .hero-circle-2 {
          position: absolute; right: 14%; top: 38%;
          width: 180px; height: 180px; border-radius: 50%;
          border: 1px solid rgba(46,204,113,0.08);
          animation: fadeIn 1.5s ease 0.8s both;
        }

        /* ── Marquee ── */
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          animation: marquee 30s linear infinite;
          width: max-content;
        }
        .marquee-item {
          padding: 0 2.5rem;
          font-size: 1rem;
          font-weight: 500;
          white-space: nowrap;
          color: var(--text-secondary);
          opacity: 0.5;
        }

        /* ── Stat cards ── */
        .stat-card {
          border: 1px solid rgba(0,0,0,0.07);
          border-radius: 16px;
          padding: 2.5rem 2rem;
          text-align: center;
          background: #fff;
          transition: all 0.4s cubic-bezier(.22,1,.36,1);
        }
        .stat-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.08);
          border-color: var(--emerald);
        }

        /* ── Process timeline ── */
        .process-line {
          position: absolute;
          left: 28px; top: 0; bottom: 0;
          width: 2px;
          background: linear-gradient(to bottom, var(--forest), var(--sage), transparent);
        }
        .process-step {
          position: relative;
          padding-left: 80px;
          padding-bottom: 2.5rem;
        }
        .process-dot {
          position: absolute;
          left: 16px; top: 4px;
          width: 26px; height: 26px;
          border-radius: 50%;
          border: 2px solid var(--forest);
          background: var(--cream);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.3s;
        }
        .process-dot-inner {
          width: 10px; height: 10px;
          border-radius: 50%;
          background: var(--forest);
          transition: all 0.3s;
        }
        .process-step:hover .process-dot {
          background: var(--forest);
          transform: scale(1.2);
        }
        .process-step:hover .process-dot-inner {
          background: #fff;
        }

        /* ── Gallery ── */
        .gallery-item {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          background: #e8e4de;
          cursor: pointer;
          height: 260px;
        }
        .gallery-item img {
          width: 100%; height: 100%;
          object-fit: cover;
          transition: transform 0.6s cubic-bezier(.22,1,.36,1);
        }
        .gallery-item:hover img { transform: scale(1.08); }
        .gallery-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(13,59,38,0.8) 0%, transparent 60%);
          opacity: 0;
          transition: opacity 0.4s;
          display: flex; align-items: flex-end; padding: 1.5rem;
        }
        .gallery-item:hover .gallery-overlay { opacity: 1; }

        /* ── Event cards ── */
        .event-card {
          border: 1px solid rgba(0,0,0,0.07);
          border-radius: 16px;
          overflow: hidden;
          background: #fff;
          transition: all 0.4s cubic-bezier(.22,1,.36,1);
        }
        .event-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 24px 64px rgba(0,0,0,0.1);
        }
        .event-tag {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #fff;
        }

        /* ── CTA Section ── */
        .cta-section {
          background: var(--forest);
          position: relative;
          overflow: hidden;
        }
        .cta-section::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 60% 60% at 80% 50%, rgba(46,204,113,0.15) 0%, transparent 70%);
        }

        /* ── Footer ── */
        .footer {
          background: var(--charcoal);
          color: #ccc;
        }
        .footer a {
          color: #ccc;
          text-decoration: none;
          transition: color 0.3s;
        }
        .footer a:hover { color: var(--emerald); }
        .logo-download-btn { display: inline-block; text-decoration: none; opacity: 1; transition: opacity 0.2s; }
        .logo-download-btn:hover { opacity: 0.8; }

        /* ── Buttons ── */
        .btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 32px;
          background: var(--emerald);
          color: var(--forest);
          font-weight: 600; font-size: 15px;
          border-radius: 50px;
          border: none; cursor: pointer;
          text-decoration: none;
          transition: all 0.3s cubic-bezier(.22,1,.36,1);
          font-family: 'General Sans', sans-serif;
        }
        .btn-primary:hover {
          background: #27ae60;
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(46,204,113,0.3);
        }
        .btn-outline {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 32px;
          background: transparent;
          color: #fff;
          font-weight: 600; font-size: 15px;
          border-radius: 50px;
          border: 1.5px solid rgba(255,255,255,0.3);
          cursor: pointer;
          text-decoration: none;
          transition: all 0.3s cubic-bezier(.22,1,.36,1);
          font-family: 'General Sans', sans-serif;
        }
        .btn-outline:hover {
          border-color: #fff;
          background: rgba(255,255,255,0.08);
        }

        /* ── Section label ── */
        .section-label {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 13px; font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--forest-mid);
          margin-bottom: 1rem;
          font-family: 'General Sans', sans-serif;
        }
        .section-label::before {
          content: '';
          width: 24px; height: 1.5px;
          background: var(--emerald);
        }

        @media (max-width: 768px) {
          .hero h1 { font-size: clamp(2.2rem, 8vw, 3.5rem) !important; }
          .process-step { padding-left: 60px; }
          .gallery-item { height: 200px; }
        }
      `}</style>

      <div className="grain sans" style={{ background: 'var(--warm-white)' }}>
        {/* Header */}
        <HomePageHeader />

        {/* ═══ HERO ═══ */}
        <section className="hero">
          <div className="hero-bg" />
          <div className="hero-grid" />
          <div className="hero-circle-1" />
          <div className="hero-circle-2" />

          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '8rem 1.5rem 6rem', position: 'relative', zIndex: 2 }}>
            <div style={{ maxWidth: 720 }}>
              <div className="section-label anim-fade-up" style={{ color: 'var(--sage)' }}>
                CSR &amp; Volunteering Platform
              </div>
              <h1
                className="serif anim-fade-up delay-1"
                style={{
                  fontSize: 'clamp(3rem, 7vw, 5.5rem)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.03em',
                  color: '#fff',
                  marginBottom: '1.5rem',
                }}
              >
                Where <em style={{ fontStyle: 'italic', color: 'var(--emerald)' }}>Kindness</em>
                <br />Takes Action
              </h1>
              <p
                className="anim-fade-up delay-2"
                style={{
                  fontSize: '1.15rem',
                  color: 'rgba(255,255,255,0.65)',
                  lineHeight: 1.7,
                  maxWidth: 520,
                  marginBottom: '2.5rem',
                }}
              >
                Curating impactful CSR and employee volunteering opportunities that connect corporate teams with communities worldwide.
              </p>
              <div className="anim-fade-up delay-3" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <a href="#events" className="btn-primary">
                  View Events <span style={{ fontSize: 18 }}>→</span>
                </a>
                <a href="#contact" className="btn-outline">Get Involved</a>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ MARQUEE ═══ */}
        <div style={{ overflow: 'hidden', padding: '1.25rem 0', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#fff' }}>
          <div className="marquee-track">
            {[0, 1].map((i) => (
              <div key={i} style={{ display: 'flex' }}>
                {["Corporate Volunteering", "Community Impact", "Digital Literacy", "Health Camps", "Environmental Drive", "Team Building", "Non-Profit Partners", "Global Reach"].map((t) => (
                  <span key={`${i}-${t}`} className="marquee-item">✦ {t}</span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ═══ ABOUT ═══ */}
        <section id="about" style={{ padding: '6rem 1.5rem', maxWidth: 1200, margin: '0 auto' }}>
          <div className="section-label">About Us</div>
          <h2
            className="serif"
            style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              lineHeight: 1.15,
              marginBottom: '1.5rem',
              maxWidth: 600,
              color: 'var(--text-primary)',
            }}
          >
            Revolutionizing the way the world{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--forest-mid)' }}>volunteers</em>
          </h2>
          <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: 1.8, maxWidth: 640, marginBottom: '1rem' }}>
            We curate opportunities for CSR and employee volunteering, engaging corporate employees in global impact initiatives and team building — virtual and in-person. We design, host, and execute end-to-end curated volunteering programs for non-profit partners and underserved communities.
          </p>
          <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: 1.8, maxWidth: 640, marginBottom: '3rem' }}>
            We are a team of problem solvers and builders on a mission to maximize impact in communities around the globe.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            {stats.map((s) => (
              <div key={s.label} className="stat-card">
                <div className="serif" style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--forest)', lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section id="how-it-works" style={{ padding: '6rem 1.5rem', background: 'var(--cream)' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div className="section-label">How It Works</div>
            <h2
              className="serif"
              style={{
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                lineHeight: 1.15,
                marginBottom: '3.5rem',
                color: 'var(--text-primary)',
              }}
            >
              Our streamlined process
            </h2>

            <div style={{ position: 'relative' }}>
              <div className="process-line" />
              {steps.map((s) => (
                <div key={s.num} className="process-step">
                  <div className="process-dot">
                    <div className="process-dot-inner" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--emerald)', letterSpacing: '0.04em' }}>
                      {s.num}
                    </span>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.title}</h3>
                  </div>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ GALLERY ═══ */}
        <section id="gallery" style={{ padding: '6rem 1.5rem', maxWidth: 1200, margin: '0 auto' }}>
          <div className="section-label">Gallery</div>
          <h2
            className="serif"
            style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              lineHeight: 1.15,
              marginBottom: '3rem',
              color: 'var(--text-primary)',
            }}
          >
            Our impact in action
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1rem',
          }}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="gallery-item">
                <img src={`/gallery/impact-${n}.jpg`} alt={`Impact ${n}`} />
                <div className="gallery-overlay">
                  <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
                    Impact Photo {n}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ EVENTS ═══ */}
        <section id="events" style={{ padding: '6rem 1.5rem', background: 'var(--cream)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div className="section-label">Upcoming</div>
            <h2
              className="serif"
              style={{
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                lineHeight: 1.15,
                marginBottom: '3rem',
                color: 'var(--text-primary)',
              }}
            >
              Events &amp; opportunities
            </h2>

            {upcomingEvents.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                No upcoming events at the moment. Check back soon!
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {upcomingEvents.map((ev) => (
                  <div key={ev._id} className="event-card">
                    {ev.imageUrl && (
                      <img
                        src={ev.imageUrl}
                        alt={ev.title}
                        style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
                      />
                    )}
                    <div style={{ padding: '2rem 2rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <span className="event-tag" style={{ background: 'var(--forest)' }}>{ev.location}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {new Date(ev.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 10, lineHeight: 1.3, color: 'var(--text-primary)' }}>
                        {ev.title}
                      </h3>
                      <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                        {ev.description}
                      </p>
                      <Link
                        href="/login"
                        style={{
                          display: 'block',
                          textAlign: 'center',
                          padding: '12px 24px',
                          borderRadius: 50,
                          background: 'var(--forest)',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: 14,
                          textDecoration: 'none',
                          transition: 'all 0.3s',
                          fontFamily: "'General Sans', sans-serif",
                        }}
                      >
                        Login to Register →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section className="cta-section" style={{ padding: '6rem 1.5rem' }}>
          <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 2 }}>
            <h2
              className="serif"
              style={{
                fontSize: 'clamp(2rem, 4.5vw, 3.2rem)',
                color: '#fff',
                lineHeight: 1.15,
                marginBottom: '1.2rem',
              }}
            >
              Ready to make a{' '}
              <em style={{ fontStyle: 'italic', color: 'var(--emerald)' }}>difference</em>?
            </h2>
            <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: '2.5rem' }}>
              Join our network of corporate partners and NGOs creating lasting impact.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a
                href="https://forms.gle/T1ACRMV27pDQqvWz8"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                Register as NGO
              </a>
              <a
                href="https://forms.gle/g2osCQAUC5us6WXw8"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
              >
                Volunteer Now
              </a>
            </div>
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer id="contact" className="footer" style={{ padding: '5rem 1.5rem 2rem' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '3rem',
              marginBottom: '3rem',
            }}>
              <div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: '#888', marginBottom: '1rem' }}>
                  Revolutionizing the way the world volunteers. Connecting corporate teams with meaningful causes.
                </p>
                <a
                  href="/kindera-logo.svg"
                  download="kindera-logo.svg"
                  title="Download Logo"
                  className="logo-download-btn"
                >
                  <img
                    src="/kindera-logo.svg"
                    alt="Kindera Logo"
                    style={{
                      width: 160,
                      height: 40,
                      borderRadius: 8,
                      background: '#fff',
                      padding: '6px 10px',
                      display: 'block',
                    }}
                  />
                </a>
              </div>

              <div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: '1rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Contact
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                  <a href="mailto:volunteering@kindera.co">volunteering@kindera.co</a>
                  <span style={{ color: '#888' }}>Delhi, India</span>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: '1rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Quick Links
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                  <a href="#about">About Us</a>
                  <a href="#how-it-works">How It Works</a>
                  <a href="#gallery">Gallery</a>
                  <a href="#events">Events</a>
                  <Link href="/login">Login</Link>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem', textAlign: 'center', fontSize: 13, color: '#666' }}>
              © 2026 Kindera. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}