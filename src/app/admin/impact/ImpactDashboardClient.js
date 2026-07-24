'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, BarChart3, TrendingUp, Users, Award, Building, Download } from 'lucide-react';
import Link from 'next/link';

export default function ImpactDashboardClient({ stats, selectedYear }) {
  const router = useRouter();

  // Handle empty defaults
  const {
    totalHours = 0,
    totalBeneficiaries = 0,
    totalEvents = 0,
    totalNGOs = 0,
    totalOrgs = 0,
    monthlyEvents = [],
    quarterlyEvents = [],
    topOrgs = []
  } = stats;

  const currentYear = new Date().getFullYear();
  const year = selectedYear || currentYear;
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleYearChange = (e) => {
    router.push(`/admin/impact?year=${e.target.value}`);
  };

  // Find max event count for scaling chart
  const maxEvents = Math.max(...monthlyEvents.map(m => m.count), 1);
  const maxQuarterEvents = Math.max(...quarterlyEvents.map(q => q.count), 1);
  // Find max hours for scaling orgs chart
  const maxHours = Math.max(...topOrgs.map(o => o.hours), 1);

  return (
    <div className="min-h-screen bg-[#fafafa] pb-24 font-sans text-gray-900">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 bg-white transition-all shadow-sm">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">Corporate Social Responsibility</p>
            <h1 className="text-3xl font-bold text-gray-900">CSR Impact Analytics</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={year} 
            onChange={handleYearChange}
            className="border-gray-200 border rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {years.map(y => (
              <option key={y} value={y}>{y} Data</option>
            ))}
          </select>
          <button 
            onClick={() => window.print()}
            className="bg-[#0d3b26] hover:bg-[#1a5c3a] text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-md transition-all print:hidden"
          >
            <Download className="w-4 h-4" /> Export CSR Report
          </button>
        </div>
      </div>

      {/* Main KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[
          { label: 'Volunteered Hours', value: totalHours.toLocaleString() + ' hrs', icon: TrendingUp, desc: 'Log-verified CSR service', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
          { label: 'NGO Partnerships', value: totalNGOs, icon: Award, desc: 'Active verified NGOs', color: 'text-purple-700 bg-purple-50 border-purple-100' },
          { label: 'Corporate Partners', value: totalOrgs, icon: Building, desc: 'Engaged organizations', color: 'text-amber-700 bg-amber-50 border-amber-100' },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className={`border rounded-2xl p-5 shadow-sm bg-white`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{k.label}</span>
                <div className={`p-2.5 rounded-xl ${k.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">{k.value}</p>
              <p className="text-[10px] text-gray-400 mt-1">{k.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Analytics Charts & Top Corporates Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Charts Column */}
        <div className="space-y-8">
          {/* Quarterly Activity Bar Chart */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-5 h-5 text-[#0d3b26]" />
              <h2 className="text-lg font-bold text-gray-900">Quarterly Events ({year})</h2>
            </div>
            
            <div className="h-40 flex items-end justify-between gap-4 px-4 pt-4 border-b border-gray-100">
              {quarterlyEvents.map((q, i) => {
                const heightPct = Math.max(8, (q.count / maxQuarterEvents) * 90);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <div className="text-xs font-bold text-gray-900 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {q.count}
                    </div>
                    <div 
                      style={{ height: `${heightPct}%` }}
                      className="w-full bg-[#1a5c3a] hover:bg-emerald-600 rounded-t-lg transition-all duration-500 shadow-sm relative group-hover:scale-x-105"
                    />
                    <span className="text-xs font-medium text-gray-400 mt-2 py-1">{q.quarter}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly Activity Bar Chart */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-5 h-5 text-[#0d3b26]" />
              <h2 className="text-lg font-bold text-gray-900">Monthly Events ({year})</h2>
            </div>
            
            <div className="h-40 flex items-end justify-between gap-1 px-4 pt-4 border-b border-gray-100">
              {monthlyEvents.map((m, i) => {
                const heightPct = Math.max(8, (m.count / maxEvents) * 90);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <div className="text-xs font-bold text-gray-900 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {m.count}
                    </div>
                    <div 
                      style={{ height: `${heightPct}%` }}
                      className="w-full bg-[#0d3b26] hover:bg-emerald-600 rounded-t-lg transition-all duration-500 shadow-sm relative group-hover:scale-x-105"
                    />
                    <span className="text-[10px] font-medium text-gray-400 mt-2 py-1 truncate">{m.month}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top Corporate Clients Grid */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-[#0d3b26]" />
                <h2 className="text-lg font-bold text-gray-900">Top Engaged Organizations</h2>
              </div>
              <span className="text-xs text-gray-500 font-medium">({year})</span>
            </div>

            {topOrgs.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <p className="text-sm">No corporate attendance recorded in {year}.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {topOrgs.map((org, index) => {
                  const widthPct = (org.hours / maxHours) * 100;
                  return (
                    <div key={index} className="border border-gray-50 hover:border-gray-100 rounded-xl p-3.5 transition-all bg-gray-50/20">
                      <div className="flex justify-between items-start mb-1.5">
                        <div>
                          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest block">Rank #{index+1}</span>
                          <h3 className="font-bold text-gray-900 text-sm leading-tight">{org.name}</h3>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900">{org.hours.toLocaleString()} hrs</span>
                          <span className="text-[10px] text-gray-400 block">{org.volunteers} Volunteers</span>
                        </div>
                      </div>

                      {/* Horizontal custom bar chart */}
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                        <div 
                          style={{ width: `${widthPct}%` }}
                          className="h-full bg-gradient-to-r from-[#0d3b26] to-emerald-600 rounded-full transition-all duration-1000"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Print custom global styles */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          .min-h-screen {
            min-height: auto !important;
            padding: 0 !important;
          }
          #certificate-print-area {
            border: 12px double #0d3b26 !important;
          }
        }
      `}</style>
    </div>
  );
}
