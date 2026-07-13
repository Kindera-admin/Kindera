'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import HomePageHeader from '@/components/HomePageHeader';

// Animation Variants
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

// Counter Component for Stats
function Counter({ value, label }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div 
      ref={ref}
      variants={fadeUp}
      className="border border-black/5 rounded-2xl p-8 text-center bg-white shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-500"
    >
      <motion.div 
        initial={{ scale: 0.5, opacity: 0 }}
        animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
        transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
        className="text-5xl md:text-6xl font-bold text-[#0d3b26] font-serif mb-2"
      >
        {value}
      </motion.div>
      <div className="text-sm font-medium text-gray-500 uppercase tracking-widest">
        {label}
      </div>
    </motion.div>
  );
}

import useAuthStore from '@/store/authStore';

export default function HomePageClient({ upcomingEvents, impactPhotos = [] }) {
  const { isAuthenticated } = useAuthStore();
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  const steps = [
    { num: "01", title: "Client Outreach", desc: "Corporate partners reach out with focus areas for volunteering." },
    { num: "02", title: "Project Mapping", desc: "We design initiatives, mapping suitable non-profit partners and communities." },
    { num: "03", title: "Organization", desc: "Kindera organizes and hosts the volunteering event end to end." },
    { num: "04", title: "Execution", desc: "We deliver volunteer outputs and assets to beneficiaries." },
    { num: "05", title: "Reporting", desc: "Impact reports delivered to corporates and volunteers." },
  ];

  return (
    <div className="bg-[#0d3b26] min-h-screen selection:bg-emerald-100 selection:text-[#0d3b26]">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700&display=swap');
        
        .font-serif { font-family: 'DM Serif Display', serif; }
        .font-sans { font-family: 'Inter', sans-serif; }
        
        .grain::before {
          content: '';
          position: fixed; inset: 0;
          opacity: 0.03;
          pointer-events: none;
          z-index: 9999;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
      `}</style>

      <HomePageHeader />

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden bg-[#0d3b26]">
        {/* Parallax Background Elements */}
        <motion.div 
          style={{ y: heroY, opacity: heroOpacity }}
          className="absolute inset-0 z-0"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/40 via-[#0d3b26] to-[#0d3b26]" />
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          
          {/* Decorative Orbs */}
          <motion.div 
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }} 
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-emerald-500/20 rounded-full blur-[100px]"
          />
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }} 
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-yellow-500/10 rounded-full blur-[80px]"
          />
        </motion.div>

        {/* Hero Content */}
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="relative z-10 text-center px-5 max-w-4xl mx-auto"
        >
          <motion.div variants={fadeUp} className="inline-block mb-6">
            <span className="px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm font-medium tracking-wide uppercase">
              CSR & Volunteering Platform
            </span>
          </motion.div>
          
          <motion.h1 
            variants={fadeUp}
            className="text-5xl md:text-7xl lg:text-[5.5rem] font-serif text-white leading-[1.1] mb-6 tracking-tight"
          >
            Where <em className="text-emerald-400 not-italic">Kindness</em> <br/> Takes Action
          </motion.h1>
          
          <motion.p 
            variants={fadeUp}
            className="text-lg md:text-xl text-emerald-50/70 max-w-2xl mx-auto mb-10 font-light leading-relaxed"
          >
            Curating impactful CSR and employee volunteering opportunities that connect corporate teams with communities worldwide.
          </motion.p>
          
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#events" className="px-8 py-4 rounded-full bg-emerald-500 text-[#0d3b26] font-semibold text-lg hover:bg-emerald-400 hover:scale-105 transition-all shadow-[0_0_40px_rgba(16,185,129,0.3)]">
              View Events
            </a>
            <a href="/signup" className="px-8 py-4 rounded-full bg-transparent border border-white/30 text-white font-semibold text-lg hover:bg-white/10 transition-all">
              Join as Partner
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* Infinite Marquee */}
      <div className="bg-white border-y border-black/5 overflow-hidden py-5">
        <motion.div 
          animate={{ x: [0, -1000] }} 
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="flex whitespace-nowrap"
        >
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center">
              {["Corporate Volunteering", "Community Impact", "Digital Literacy", "Health Camps", "Environmental Drive", "Team Building"].map(t => (
                <span key={t} className="text-sm font-medium text-gray-400 uppercase tracking-widest mx-8">
                  ✦ &nbsp;&nbsp;{t}
                </span>
              ))}
            </div>
          ))}
        </motion.div>
      </div>

      {/* About Section */}
      <section id="about" className="py-24 md:py-32 bg-[#fafafa]">
        <div className="px-5 max-w-7xl mx-auto">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-3xl mx-auto text-center mb-20"
        >
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-serif text-[#0d3b26] mb-6 leading-tight">
            Revolutionizing the way the world <span className="italic text-emerald-600">volunteers</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-gray-600 leading-relaxed">
            We curate opportunities for CSR and employee volunteering, engaging corporate employees in global impact initiatives and team building. We design, host, and execute end-to-end programs for non-profits and underserved communities.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Counter value="100+" label="NGOs Registered" />
          <Counter value="100k+" label="People Helped" />
          <Counter value="1,000+" label="Events Conducted" />
        </div>
        </div>
      </section>

      {/* How It Works (Bento Grid Style) */}
      <section id="how-it-works" className="py-24 bg-[#f0f7f3]">
        <div className="max-w-7xl mx-auto px-5">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="text-4xl md:text-5xl font-serif text-[#0d3b26] mb-4">Our Streamlined Process</h2>
            <p className="text-gray-600">How we turn corporate intent into community impact.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`bg-white rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-[#0d3b26]/5 ${i === 0 || i === 3 ? 'md:col-span-2 lg:col-span-1' : ''}`}
              >
                <div className="text-4xl font-bold text-emerald-100 mb-4">{step.num}</div>
                <h3 className="text-xl font-bold text-[#0d3b26] mb-3">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Curated Volunteering Opportunities - Public */}
      <section id="opportunities" className="py-24 bg-[#fafafa] border-t border-black/5">
        <div className="max-w-7xl mx-auto px-5">

          {/* Section Header */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-14 text-center"
          >
            <motion.p variants={fadeUp} className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-3">
              Volunteer With Purpose
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-serif text-[#0d3b26] mb-4">
              Curated Volunteering Opportunities
            </motion.h2>
            <motion.p variants={fadeUp} className="text-gray-500 max-w-xl mx-auto text-base">
              For every occasion — festive, corporate, or humanitarian — we have the perfect volunteering experience ready for your team.
            </motion.p>
          </motion.div>

          {/* Image Cards Grid */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {[
              { label: 'Retreats and Offsite',          img: '/occasions/retreats-offsite.jpg'   },
              { label: 'Conference',                     img: '/occasions/conference.jpg'          },
              { label: 'New Employee Onboarding',        img: '/occasions/onboarding.jpg'          },
              { label: 'Disaster Relief',                img: '/occasions/disaster-relief.jpg'     },
              { label: 'Annual Celebration & Culture Days', img: '/occasions/culture-days.jpg'    },
              { label: 'Welcome Back to Office',         img: '/occasions/welcome-back.jpg'        },
              { label: 'Month of Service',               img: '/occasions/month-of-service.jpg'    },
              { label: 'ERG Engagement',                 img: '/occasions/erg-engagement.jpg'      },
              { label: 'Festivals',                      img: '/occasions/festivals.jpg'           },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                variants={fadeUp}
                className="group relative overflow-hidden rounded-2xl shadow-md hover:shadow-2xl transition-all duration-500 cursor-pointer hover:-translate-y-1"
              >
                {/* Photo */}
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={card.img}
                    alt={card.label}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>

                {/* Dark banner label at bottom — matching user's reference style */}
                <div className="bg-[#0d1f3c] px-5 py-4 flex items-center justify-between">
                  <h3 className="text-white font-bold text-sm md:text-base uppercase tracking-wide leading-tight">
                    {card.label}
                  </h3>
                  <span className="text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all text-lg ml-3 flex-shrink-0">→</span>
                </div>

                {/* Hover overlay CTA */}
                <div className="absolute inset-0 bg-[#0d3b26]/0 group-hover:bg-[#0d3b26]/20 transition-all duration-500 pointer-events-none" />
              </motion.div>
            ))}
          </motion.div>

          {/* Bottom CTA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="mt-12 bg-[#0d3b26] rounded-3xl px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6"
          >
            <div>
              <p className="text-emerald-300 text-xs font-semibold tracking-widest uppercase mb-1">Don&apos;t see your occasion?</p>
              <h3 className="text-white text-2xl font-serif">We curate opportunities year-round.</h3>
              <p className="text-emerald-200 text-sm mt-1">Get in touch and we&apos;ll match you with the perfect cause.</p>
            </div>
            <Link
              href="/login"
              className="flex-shrink-0 bg-white text-[#0d3b26] font-bold px-7 py-3.5 rounded-full hover:bg-emerald-50 transition-colors text-sm tracking-wide"
            >
              Get Started →
            </Link>
          </motion.div>

        </div>
      </section>



      {/* Impact Gallery */}
      <section id="gallery" className="py-24 bg-[#fafafa]">
        <div className="px-5 max-w-7xl mx-auto">
        <div className="mb-12">
          <h2 className="text-4xl md:text-5xl font-serif text-[#0d3b26]">Impact in Action</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {impactPhotos.length > 0 ? (
            impactPhotos.map((photo, i) => (
              <motion.div
                key={photo._id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative rounded-2xl overflow-hidden group bg-gray-200 aspect-[4/3]"
              >
                <img src={photo.url} alt="Impact" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                  <span className="text-white font-medium">Making a difference</span>
                </div>
              </motion.div>
            ))
          ) : (
            [1, 2, 3, 4].map((n, i) => (
              <motion.div
                key={n}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative rounded-2xl overflow-hidden group bg-gray-200 aspect-[4/3]"
              >
                <img src={`/gallery/impact-${n}.jpg`} alt="Impact" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                  <span className="text-white font-medium">Making a difference</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
        </div>
      </section>

      {/* Events - only shown to logged-in users */}
      {isAuthenticated() && (
        <section id="events" className="py-24 bg-white border-t border-black/5">
          <div className="max-w-7xl mx-auto px-5">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
              <div>
                <h2 className="text-4xl md:text-5xl font-serif text-[#0d3b26] mb-4">Upcoming Events</h2>
                <p className="text-gray-500 max-w-xl">Join our upcoming volunteer initiatives and be part of the change.</p>
              </div>
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-3xl border border-gray-100">
                <p className="text-gray-500 text-lg">No upcoming events right now. Check back soon!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {upcomingEvents.map((ev, i) => (
                  <motion.div
                    key={ev._id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="group bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-500"
                  >
                    <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                      {ev.imageUrl ? (
                        <img src={ev.imageUrl} alt={ev.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full bg-emerald-900/10 flex items-center justify-center text-emerald-800 font-serif text-2xl">Kindera</div>
                      )}
                      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-4 py-1.5 rounded-full text-xs font-bold text-[#0d3b26] uppercase tracking-wide">
                        {ev.location}
                      </div>
                    </div>
                    <div className="p-8">
                      <p className="text-emerald-600 text-sm font-semibold mb-3">
                        {new Date(ev.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      <h3 className="text-2xl font-bold text-gray-900 mb-3 line-clamp-2">{ev.title}</h3>
                      <p className="text-gray-500 mb-8 line-clamp-3 leading-relaxed">{ev.description}</p>
                      <Link href={`/events/${ev._id}/register`} className="inline-flex items-center text-[#0d3b26] font-semibold hover:text-emerald-600 transition-colors">
                        Register 
                        <span className="ml-2 transform group-hover:translate-x-1 transition-transform">→</span>
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* CTA Footer Wrapper */}
      <section className="bg-[#0d3b26] text-white pt-24 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent" />
        
        <div className="max-w-4xl mx-auto text-center px-5 relative z-10 mb-24">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-5xl md:text-6xl font-serif mb-6"
          >
            Ready to make a <span className="text-emerald-400 italic">difference</span>?
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-emerald-50/70 text-lg mb-10 max-w-2xl mx-auto"
          >
            Join our network of corporate partners and NGOs creating lasting impact.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row justify-center gap-4"
          >
            <a href="https://forms.gle/T1ACRMV27pDQqvWz8" target="_blank" rel="noopener noreferrer" className="px-8 py-4 rounded-full bg-emerald-500 text-[#0d3b26] font-semibold hover:bg-emerald-400 transition-all">
              Register as NGO
            </a>
            <a href="/signup" className="px-8 py-4 rounded-full border border-white/20 text-white font-semibold hover:bg-white/10 transition-all">
              Volunteer Now
            </a>
          </motion.div>
        </div>

        {/* Actual Footer Links */}
        <div className="max-w-7xl mx-auto px-5 relative z-10 border-t border-white/10 pt-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <Image 
                src="/kindera-logo.png" 
                alt="Kindera" 
                width={140} 
                height={48} 
                className="object-contain brightness-0 invert mb-6" 
              />
              <p className="text-emerald-50/50 max-w-sm leading-relaxed text-sm">
                Revolutionizing the way the world volunteers. Connecting corporate teams with meaningful causes globally.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold uppercase tracking-widest text-sm mb-6">Contact</h4>
              <ul className="space-y-3 text-emerald-50/60 text-sm">
                <li><a href="mailto:volunteering@kindera.co" className="hover:text-white transition-colors">volunteering@kindera.co</a></li>
                <li>Delhi, India</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold uppercase tracking-widest text-sm mb-6">Quick Links</h4>
              <ul className="space-y-3 text-emerald-50/60 text-sm">
                <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#events" className="hover:text-white transition-colors">Events</a></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Login</Link></li>
              </ul>
            </div>
          </div>
          <div className="text-center text-emerald-50/40 text-sm">
            © {new Date().getFullYear()} Kindera. All rights reserved.
          </div>
        </div>
      </section>
      
      <div className="grain" />
    </div>
  );
}
