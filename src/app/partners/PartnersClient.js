'use client';

import { useState } from 'react';
import { Search, MapPin, Globe, ExternalLink, Tag, BookOpen, Award, Sparkles, Heart } from 'lucide-react';
import Link from 'next/link';
import HomePageHeader from '@/components/HomePageHeader';

export default function PartnersClient({ partners }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFocus, setSelectedFocus] = useState('All');

  // Extract unique focus areas for filters
  const focusAreasSet = new Set(['All']);
  partners.forEach(p => {
    if (p.focusAreas) {
      p.focusAreas.split(',').forEach(f => focusAreasSet.add(f.trim()));
    }
  });
  const allFocusAreas = Array.from(focusAreasSet);

  const filtered = partners.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.focusAreas && p.focusAreas.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFocus = selectedFocus === 'All' || 
      (p.focusAreas && p.focusAreas.split(',').map(f => f.trim()).includes(selectedFocus));

    return matchesSearch && matchesFocus;
  });

  return (
    <div className="bg-[#fafafa] min-h-screen font-sans">
      <HomePageHeader />

      {/* Decorative Top Hero Header */}
      <div className="bg-[#0d3b26] text-white pt-36 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent" />
        <div className="max-w-6xl mx-auto px-5 relative z-10 text-center">
          <span className="px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-semibold tracking-wider uppercase mb-4 inline-block">
            Our Ecosystem
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif mb-4 text-white leading-tight">
            Our NGO Partners
          </h1>
          <p className="text-emerald-50/70 max-w-xl mx-auto text-sm md:text-base font-light leading-relaxed">
            Collaborating with outstanding non-profits to channel corporate resources, employee volunteer hours, and skills directly to grassroots communities.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-12 relative z-10 -mt-10">
        {/* Search & Filter Toolbar */}
        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 mb-10">
          <div className="relative w-full md:max-w-sm shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by NGO name, keywords..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-100 rounded-xl focus:outline-none focus:border-emerald-500 bg-gray-50/50"
            />
          </div>

          {/* Focus Area Filter Badges */}
          <div className="flex flex-wrap gap-2 justify-start md:justify-end w-full overflow-x-auto no-scrollbar py-1">
            {allFocusAreas.map(focus => (
              <button
                key={focus}
                onClick={() => setSelectedFocus(focus)}
                className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all ${
                  selectedFocus === focus
                    ? 'bg-[#0d3b26] text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {focus}
              </button>
            ))}
          </div>
        </div>

        {/* NGO Grid */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-3xl p-20 text-center shadow-sm">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-base font-medium">No partners matching the criteria found.</p>
            <button 
              onClick={() => { setSearchTerm(''); setSelectedFocus('All'); }}
              className="text-[#0d3b26] font-semibold text-sm hover:underline mt-2"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filtered.map(ngo => (
              <div 
                key={ngo._id} 
                className="bg-white border border-gray-100/80 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* NGO header with logo badge */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#0d3b26] flex items-center justify-center text-white text-lg font-bold shadow-md shrink-0">
                      {ngo.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 leading-snug">{ngo.name}</h2>
                      {(ngo.registeredOffice || ngo.location) && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          {ngo.registeredOffice || ngo.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Focus Area Tags */}
                  {ngo.focusAreas && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {ngo.focusAreas.split(',').map((f, i) => (
                        <span 
                          key={i}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-100"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {f.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-gray-600 text-sm leading-relaxed mb-6">
                    {ngo.description}
                  </p>

                  {/* Programs & Offerings */}
                  {ngo.programs && ngo.programs.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[#0d3b26]" /> Key Programs
                      </h3>
                      <ul className="space-y-1.5 pl-1.5">
                        {ngo.programs.map((prog, idx) => (
                          <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                            <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                            <span>{prog}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Impact statement banner */}
                  {ngo.impact && (
                    <div className="bg-[#f0f7f3]/50 border border-emerald-100/50 rounded-2xl p-4 mb-6">
                      <h3 className="text-xs font-bold text-[#0d3b26] uppercase tracking-widest mb-1 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5" /> Direct Impact
                      </h3>
                      <p className="text-xs text-emerald-950 font-medium leading-relaxed">
                        {ngo.impact}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer URL link */}
                {ngo.website && (
                  <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                    <a
                      href={ngo.website.startsWith('http') ? ngo.website : `https://${ngo.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0d3b26] hover:text-[#1a5c3a] transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5" /> Visit Website
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Sticky registration bottom card */}
        <div className="mt-16 bg-[#0d3b26] rounded-3xl p-8 md:p-12 text-center text-white relative overflow-hidden shadow-xl">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent" />
          <div className="relative z-10 max-w-xl mx-auto">
            <Sparkles className="w-8 h-8 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-serif mb-3">Register your NGO with Kindera</h2>
            <p className="text-emerald-50/70 text-xs md:text-sm leading-relaxed mb-6 font-light">
              Are you an NGO looking for corporate support, employee volunteering initiatives, and skills-based CSR investments? Join our network.
            </p>
            <a
              href="https://forms.gle/T1ACRMV27pDQqvWz8"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-white text-[#0d3b26] px-8 py-3.5 rounded-full font-bold hover:bg-emerald-50 transition-colors text-sm shadow-md"
            >
              Apply for Partnership
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
