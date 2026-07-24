'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Building2, Users, Clock, CalendarDays, ArrowRight, Plus, Loader2, X, Star, HeartHandshake, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getOrgStats } from '@/app/actions';

const STAT_ICONS = {
  members: Users,
  hours: Clock,
  events: CalendarDays,
};

export default function CorporateOverviewClient({ orgs }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeOrg, setActiveOrg] = useState(null);
  const [selectedOrgStats, setSelectedOrgStats] = useState(null);
  const [loadingStatsOrg, setLoadingStatsOrg] = useState(null);

  const totalOrgs    = orgs.length;
  const totalMembers = orgs.reduce((s, o) => s + o.memberCount, 0);
  const totalHours   = orgs.reduce((s, o) => s + o.volunteerHours, 0);
  const totalEvents  = orgs.reduce((s, o) => s + o.eventsAttended, 0);

  const handleGenerate = (orgName) => {
    router.push(`/dashboard/team/generate?org=${encodeURIComponent(orgName)}`);
  };

  const handleViewStats = async (orgName) => {
    setLoadingStatsOrg(orgName);
    try {
      const res = await getOrgStats(orgName);
      if (res.success) {
        setSelectedOrgStats({ orgName, stats: res.stats, monthly: res.monthly, eventsList: res.eventsList });
      } else {
        toast.error(res.message || 'Failed to fetch organisation stats');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStatsOrg(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">Admin</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Corporate Overview</h1>
        <p className="text-gray-500 text-sm">All registered corporate volunteer organisations and their KPIs.</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Organisations', value: totalOrgs, color: '#0d3b26' },
          { label: 'Total Members', value: totalMembers, color: '#1a5c3a' },
          { label: 'Volunteer Hours', value: totalHours.toLocaleString(), color: '#2e7d52' },
          { label: 'Events Attended', value: totalEvents, color: '#3d5a99' },
        ].map(k => (
          <div key={k.label} className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm">
            <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">All Organisations</h2>
          <Button
            size="sm"
            onClick={() => router.push('/dashboard/team/generate')}
            className="gap-1.5 bg-[#0d3b26] hover:bg-[#1a5c3a] text-white"
          >
            <Plus className="w-4 h-4" />
            Generate Logins
          </Button>
        </div>

        {orgs.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No corporate organisations yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-6 py-3 text-left">Organisation</th>
                <th className="px-6 py-3 text-left">SPOC</th>
                <th className="px-6 py-3 text-right">Members</th>
                <th className="px-6 py-3 text-right">Hours</th>
                <th className="px-6 py-3 text-right">Events</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(org => (
                <tr key={org.spocId} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#0d3b26] flex items-center justify-center text-white text-xs font-bold">
                        {org.organizationName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{org.organizationName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{org.spocName}</td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-gray-800">{org.memberCount}</td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-[#0d3b26]">{org.volunteerHours.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-600">{org.eventsAttended}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3.5">
                      <button
                        onClick={() => handleViewStats(org.organizationName)}
                        disabled={loadingStatsOrg !== null}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1"
                      >
                        {loadingStatsOrg === org.organizationName ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : null}
                        View Stats
                      </button>
                      <button
                        onClick={() => handleGenerate(org.organizationName)}
                        className="text-xs font-semibold text-[#0d3b26] hover:text-[#2e7d52] transition-colors"
                      >
                        + Logins
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Selected Org Stats Modal */}
      {selectedOrgStats && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full relative shadow-2xl overflow-y-auto max-h-[90vh] border border-gray-100">
            <button 
              onClick={() => setSelectedOrgStats(null)}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#0d3b26] flex items-center justify-center text-white text-base font-bold shadow-md shrink-0">
                {selectedOrgStats.orgName.charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#2e7d52] uppercase tracking-widest block leading-none mb-1">Corporate Partner Analytics</span>
                <h2 className="text-xl font-bold text-gray-900 leading-none">{selectedOrgStats.orgName}</h2>
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Volunteered Hours', value: selectedOrgStats.stats.volunteerHours.toLocaleString() + ' hrs', icon: Clock, color: 'text-emerald-700 bg-emerald-50' },
                { label: 'Employees Joined', value: selectedOrgStats.stats.totalVolunteers, icon: Users, color: 'text-blue-700 bg-blue-50' },
                { label: 'Events Attended', value: selectedOrgStats.stats.eventsAttended, icon: CalendarDays, color: 'text-purple-700 bg-purple-50' },
                { label: 'NGOs Engaged', value: selectedOrgStats.stats.ngosEngaged, icon: HeartHandshake, color: 'text-rose-700 bg-rose-50' },
                { label: 'Avg Rating Given', value: selectedOrgStats.stats.avgFeedback ? `${selectedOrgStats.stats.avgFeedback}/5` : '–', icon: Star, color: 'text-amber-500 bg-amber-50/50' },
              ].map((m, idx) => {
                const Icon = m.icon;
                return (
                  <div key={idx} className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none">{m.label}</span>
                      <div className={`p-1.5 rounded-lg ${m.color} shrink-0`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <p className="text-lg font-bold text-gray-900 mt-1">{m.value}</p>
                  </div>
                );
              })}
            </div>

            {/* Monthly Trend Chart */}
            {selectedOrgStats.monthly && selectedOrgStats.monthly.length > 0 ? (
              <div className="border border-gray-100 rounded-2xl p-5 bg-white">
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest mb-4">Volunteering Hours Monthly Trend</h3>
                <div className="h-40 flex items-end gap-2 px-2 pt-2 border-b border-gray-100">
                  {selectedOrgStats.monthly.map((m, idx) => {
                    const maxVal = Math.max(...selectedOrgStats.monthly.map(mo => mo.hours), 1);
                    const pct = Math.max(10, (m.hours / maxVal) * 80);
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group">
                        <span className="text-[10px] font-bold text-gray-800 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {m.hours}h
                        </span>
                        <div 
                          style={{ height: `${pct}%` }} 
                          className="w-full bg-[#0d3b26] hover:bg-emerald-600 rounded-t transition-all duration-300 relative"
                        >
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap z-20">
                            {m.hours} hrs ({m.count} events)
                          </div>
                        </div>
                        <span className="text-[9px] font-medium text-gray-400 mt-1.5 truncate max-w-full">{m.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center text-gray-400 text-xs">
                No monthly volunteer trend recorded yet.
              </div>
            )}

            {/* Engaged Events History List */}
            <div className="mt-6 border-t border-gray-100 pt-6">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest mb-3">Engaged Events History</h3>
              {selectedOrgStats.eventsList && selectedOrgStats.eventsList.length > 0 ? (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {selectedOrgStats.eventsList.map(ev => (
                    <div key={ev._id} className="border border-gray-50 rounded-xl p-3 bg-gray-50/20 hover:bg-gray-50/55 transition-all flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-gray-900 leading-snug">{ev.title}</h4>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            ev.isCorporate 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {ev.isCorporate ? 'Personal/Corp' : 'Global'}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 block mt-1">
                          {new Date(ev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {ev.location ? ` · ${ev.location}` : ''}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-[#0d3b26] block">{ev.hours.toLocaleString()} hrs</span>
                        <span className="text-[9px] text-gray-400 block">{ev.attendees} Attended</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No event participation recorded yet.</p>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
