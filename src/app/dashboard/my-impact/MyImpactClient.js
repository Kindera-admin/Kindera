'use client';

import { useState, useTransition } from 'react';
import { Award, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Clock, Loader2, MapPin, Star, Activity, Globe, Building2, Users } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { logMyHoursAndFeedback } from '@/app/actions';

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(null);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(null)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className="w-5 h-5"
            fill={(hover || value) >= s ? '#f59e0b' : 'none'}
            stroke={(hover || value) >= s ? '#f59e0b' : '#d1d5db'}
          />
        </button>
      ))}
    </div>
  );
}

function EventCard({ event, userName, onShowCertificate }) {
  const [expanded, setExpanded] = useState(false);
  const [hours, setHours] = useState(event.myHours || '');
  const [feedback, setFeedback] = useState(event.myFeedback || null);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(event.myHours > 0);

  const handleSave = () => {
    const h = parseFloat(hours);
    if (!h || h <= 0 || h > 24) {
      toast.error('Please enter valid hours (0.5 – 24)');
      return;
    }
    startTransition(async () => {
      const res = await logMyHoursAndFeedback(event._id, h, feedback);
      if (res.success) {
        toast.success('Hours logged successfully!');
        setSaved(true);
        setExpanded(false);
      } else {
        toast.error(res.message || 'Failed to save');
      }
    });
  };

  const dateStr = new Date(event.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata',
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div className={`border rounded-xl bg-white shadow-sm overflow-hidden transition-all duration-200 ${event.isPast ? 'border-gray-100' : 'border-emerald-100'}`}>
      <div className="flex items-start gap-4 p-5">
        {/* Date badge */}
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center text-center ${event.isPast ? 'bg-gray-100' : 'bg-emerald-50'}`}>
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${event.isPast ? 'text-gray-400' : 'text-emerald-600'}`}>
            {new Date(event.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short' })}
          </span>
          <span className={`text-lg font-bold leading-none ${event.isPast ? 'text-gray-600' : 'text-emerald-700'}`}>
            {new Date(event.date).getDate()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/events/${event._id}/register`} className="hover:underline">
              <h3 className="font-semibold text-gray-900 text-sm leading-snug">{event.title}</h3>
            </Link>
            <div className="flex items-center gap-2 flex-shrink-0">
              {saved && (
                <span className="flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Logged
                </span>
              )}
              {event.lifecycle !== 'ended' && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${event.lifecycle === 'live' ? 'bg-green-100 text-green-800' : 'bg-blue-50 text-blue-700'}`}>
                  {event.lifecycle.charAt(0).toUpperCase() + event.lifecycle.slice(1)}
                </span>
              )}
              {event.myRegistrationStatus && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  event.myRegistrationStatus === 'approved' ? 'bg-emerald-100 text-emerald-800' : 
                  event.myRegistrationStatus === 'rejected' ? 'bg-red-100 text-red-800' : 
                  'bg-amber-100 text-amber-800'
                }`}>
                  Reg: {event.myRegistrationStatus.charAt(0).toUpperCase() + event.myRegistrationStatus.slice(1)}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" /> {dateStr}
            </p>
            {event.location && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {event.location}
              </p>
            )}
          </div>

          {/* Stats if logged */}
          <div className="flex items-center justify-between gap-4 mt-2">
            <div className="flex gap-4">
              {saved && event.myHours > 0 && (
                <span className="text-xs text-[#0d3b26] font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {hours || event.myHours}h logged
                </span>
              )}
              {saved && feedback && (
                <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" /> {feedback}/5
                </span>
              )}
            </div>
            
            {event.attended && (
              <button
                onClick={() => onShowCertificate(event)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 border border-emerald-200 px-2.5 py-1 rounded-lg bg-emerald-50/50 hover:bg-emerald-50 transition-all shrink-0 shadow-sm"
              >
                <Award className="w-3.5 h-3.5" /> Certificate
              </button>
            )}
          </div>
        </div>

        {/* Log hours button for past events */}
        {event.isPast && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 text-xs font-semibold text-[#0d3b26] hover:text-emerald-600 flex items-center gap-1 transition-colors"
          >
            {saved ? 'Edit' : 'Log Hours'}
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Expandable log form */}
      {event.isPast && expanded && (
        <div className="border-t border-gray-100 bg-gray-50/60 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Log Your Contribution</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 font-medium mb-1.5">Hours Contributed</label>
              <input
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 4"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 font-medium mb-1.5">Rate Your Experience</label>
              <StarRating value={feedback} onChange={setFeedback} />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="mt-4 px-5 py-2 bg-[#0d3b26] text-white text-sm font-semibold rounded-lg hover:bg-[#1a5c3a] transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save
          </button>
        </div>
      )}
    </div>
  );
}

import { Button } from '@/components/ui/button';

export default function MyImpactClient({ events, stats }) {
  const pastEvents = events.filter(e => e.isPast);
  const upcomingEvents = events.filter(e => !e.isPast);
  const attendedEvents = events.filter(e => e.attended);
  const [activeCertificate, setActiveCertificate] = useState(null);

  const handleShowCertificate = (event) => {
    setActiveCertificate({ event, userName: stats.name || 'Volunteer' });
  };

  const totalHours = stats.totalHours || 0;
  
  let currentBadge = 'Bronze Helper';
  let nextBadge = 'Silver Hero';
  let badgeHoursNeeded = 5;
  let prevBadgeHours = 0;
  let badgeProgress = 0;
  let badgeDescription = 'Thank you for starting your volunteering journey with Kindera!';
  let badgeColor = 'from-amber-600 to-amber-700 text-amber-50';

  if (totalHours >= 30) {
    currentBadge = 'Impact Legend';
    nextBadge = 'Max Level';
    badgeHoursNeeded = 30;
    prevBadgeHours = 30;
    badgeProgress = 100;
    badgeDescription = 'You are a legendary volunteer! Your commitment is inspiring.';
    badgeColor = 'from-purple-600 to-indigo-700 text-indigo-50';
  } else if (totalHours >= 15) {
    currentBadge = 'Gold Champion';
    nextBadge = 'Impact Legend';
    badgeHoursNeeded = 30;
    prevBadgeHours = 15;
    badgeProgress = ((totalHours - 15) / 15) * 100;
    badgeDescription = 'Outstanding contributions! Keep up the excellent volunteering work.';
    badgeColor = 'from-yellow-500 to-amber-600 text-yellow-50';
  } else if (totalHours >= 5) {
    currentBadge = 'Silver Hero';
    nextBadge = 'Gold Champion';
    badgeHoursNeeded = 15;
    prevBadgeHours = 5;
    badgeProgress = ((totalHours - 5) / 10) * 100;
    badgeDescription = 'Great progress! You are officially a certified Silver Hero.';
    badgeColor = 'from-slate-400 to-slate-500 text-slate-50';
  } else {
    // 0 to 5 hours
    badgeProgress = (totalHours / 5) * 100;
  }

  return (
    <div className="w-full max-w-3xl mx-auto print:max-w-none print:w-full print:m-0">
      <div className="print:hidden">
        {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">My Dashboard</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">My Volunteer Impact</h1>
        <p className="text-gray-500 text-sm">
          {stats.organizationName && <span className="font-medium text-gray-700">{stats.organizationName} · </span>}
          Log your hours for past events and track your personal contribution.
        </p>
      </div>

      {/* Personal KPI Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm text-center">
          <Clock className="w-5 h-5 text-[#0d3b26] mx-auto mb-1.5" />
          <p className="text-2xl font-bold text-[#0d3b26]">{stats.totalHours || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Hours Logged</p>
        </div>
        <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm text-center">
          <CalendarDays className="w-5 h-5 text-[#1a5c3a] mx-auto mb-1.5" />
          <p className="text-2xl font-bold text-[#1a5c3a]">{stats.eventsAttended || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Events Attended</p>
        </div>
        <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm text-center">
          <Star className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
          <p className="text-2xl font-bold text-amber-600">{stats.avgFeedback ? `${stats.avgFeedback}/5` : '–'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Avg Rating Given</p>
        </div>
      </div>

      {/* Visual Impact Dashboard Extensions */}
      <div className="mb-8">
        {/* Achievements / Badge Card */}
        <div className="w-full border border-gray-100 rounded-2xl p-6 bg-white shadow-sm flex flex-col justify-between min-h-[140px]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest leading-none">Achievement Level</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${badgeColor} shrink-0`}>
                {currentBadge}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-6">{badgeDescription}</p>
          </div>
          
          {nextBadge !== 'Max Level' ? (
            <div>
              <div className="flex justify-between items-center text-[10px] font-semibold text-gray-500 mb-2 leading-none">
                <span>{totalHours} hrs logged</span>
                <span>{badgeHoursNeeded - totalHours} hrs left for {nextBadge}</span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${badgeProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-3 bg-purple-50 rounded-xl border border-purple-100 text-[10px] font-semibold text-purple-700">
              🎉 Congratulations! You have unlocked the highest volunteer badge level!
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Upcoming Events</h2>
          <div className="space-y-3">
            {upcomingEvents.map(ev => <EventCard key={ev._id} event={ev} userName={stats.name} onShowCertificate={handleShowCertificate} />)}
          </div>
        </div>
      )}

      {/* My Participation Panel */}
      <div className="mb-8 border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#0d3b26]" />
          My Participation History
        </h2>
        
        {attendedEvents.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            You haven&apos;t participated in any events yet. Once marked as attended, your history will populate here!
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {attendedEvents.map(ev => (
              <div key={ev._id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">{ev.title}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-medium">
                      {new Date(ev.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-gray-300 text-[10px]">•</span>
                    {ev.organizationName ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                        <Building2 className="w-2.5 h-2.5" />
                        Internal Event ({ev.organizationName})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5" />
                        Global Event
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <span className="text-xs font-semibold text-gray-600 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#0d3b26]" />
                    {ev.myHours || ev.durationHours} hrs logged
                  </span>
                  
                  <button
                    onClick={() => handleShowCertificate(ev)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 border border-emerald-200 px-2.5 py-1 rounded-lg bg-emerald-50/50 hover:bg-emerald-50 transition-all shadow-sm"
                  >
                    <Award className="w-3.5 h-3.5" /> Certificate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Events */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Past Events — Log Your Hours</h2>
        {pastEvents.length === 0 ? (
          <div className="border border-dashed border-gray-200 rounded-xl py-12 text-center">
            <Award className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No past events yet. Check back after events are completed!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pastEvents.map(ev => <EventCard key={ev._id} event={ev} userName={stats.name} onShowCertificate={handleShowCertificate} />)}
          </div>
        )}
      </div>
      </div>

      {/* Certificate Modal */}
      {activeCertificate && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:p-0 print:static print:bg-white overflow-y-auto">
          <style dangerouslySetInnerHTML={{ __html: `
            @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');
            @media print {
              @page { size: landscape; margin: 0; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
            }
          `}} />
          
          <div className="bg-white max-w-4xl w-full relative overflow-hidden shadow-2xl print:shadow-none min-h-[600px] print:min-h-0 print:h-[100vh] print:w-[100vw] print:max-w-none flex flex-col justify-center" id="certificate-print-area">
            
            {/* Top Right Dark Blue curved shape & "Where Kindness Takes Action" */}
            <div className="absolute top-0 right-0 w-80 h-32 bg-[#0A1A3B] rounded-bl-full z-0 flex items-center justify-center pl-8 pt-4">
              <div className="flex items-center text-white gap-3 transform -translate-y-2">
                <div className="w-8 h-8 rounded-full border border-white flex items-center justify-center">
                  <div className="w-4 h-4 text-[#76A854]">
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                  </div>
                </div>
                <div className="text-xs font-semibold leading-tight">Where<br/>Kindness<br/>Takes Action</div>
              </div>
            </div>
            
            {/* Top Right Green Curve Underneath */}
            <div className="absolute top-24 right-0 w-64 h-16 bg-[#76A854] rounded-bl-full z-[-1] transform -translate-y-4 translate-x-4"></div>

            {/* Bottom Left Green Curve */}
            <div className="absolute bottom-0 left-0 w-64 h-32 bg-[#76A854] rounded-tr-full z-0 transform translate-y-8 -translate-x-8"></div>
            {/* Bottom Left Dark Blue Curve */}
            <div className="absolute bottom-0 left-0 w-48 h-20 bg-[#0A1A3B] rounded-tr-full z-0"></div>
            
            <div className="relative z-10 px-12 py-16 text-center h-full flex flex-col">
              
              {/* Top Left: Corporate Logo */}
              <div className="absolute top-10 left-12 flex items-center gap-3 text-left">
                {stats.organizationLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={stats.organizationLogo} alt={stats.organizationName} className="h-24 object-contain" />
                ) : (
                  <span className="text-2xl font-bold text-[#0A1A3B] border-l-4 border-[#76A854] pl-3">
                    {stats.organizationName || 'Corporate Partner'}
                  </span>
                )}
              </div>
              
              <div className="mt-16 mb-4 flex-grow">
                <h1 className="text-4xl md:text-5xl font-bold text-[#0A1A3B] tracking-widest mb-1">CERTIFICATE</h1>
                <div className="flex items-center justify-center gap-4">
                  <div className="h-px bg-[#76A854] w-16"></div>
                  <h2 className="text-lg md:text-xl font-semibold tracking-[0.2em] text-[#0A1A3B]">OF VOLUNTEERING</h2>
                  <div className="h-px bg-[#76A854] w-16"></div>
                </div>
              </div>
              
              <p className="text-gray-500 text-sm mt-8 mb-2">This is to certify that</p>
              
              {/* Volunteer Name */}
              <h2 
                className="text-5xl md:text-6xl text-[#0A1A3B] mb-2 px-12 pb-2 inline-block border-b border-gray-300"
                style={{ fontFamily: "'Great Vibes', cursive" }}
              >
                {activeCertificate.userName}
              </h2>
              
              <p className="text-gray-600 mt-2 mb-4">
                from <strong className="text-[#0A1A3B]">{stats.organizationName || 'our corporate partner'}</strong>
              </p>
              
              <p className="text-gray-500 text-sm mb-2">has participated in</p>
              <p className="text-lg md:text-xl font-bold text-[#76A854] mb-4">
                {activeCertificate.event.title}
              </p>
              
              <p className="text-gray-600 text-sm max-w-lg mx-auto mb-10 leading-relaxed">
                Your contribution has made a positive impact on the environment and inspiring change in the community.
              </p>
              
              {/* Stats Footer */}
              <div className="flex justify-center items-start gap-12 border-t border-gray-100 pt-6 max-w-2xl mx-auto mb-12">
                <div className="text-center">
                  <div className="w-10 h-10 mx-auto bg-[#76A854] rounded-full flex items-center justify-center text-white mb-2 shadow-md">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-gray-800">Date</p>
                  <p className="text-xs text-gray-500">{new Date(activeCertificate.event.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                
                <div className="text-center border-l border-r border-gray-200 px-12">
                  <div className="w-10 h-10 mx-auto bg-[#76A854] rounded-full flex items-center justify-center text-white mb-2 shadow-md">
                    <Users className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-gray-800">Volunteer Hours</p>
                  <p className="text-xs text-gray-500">{activeCertificate.event.myHours || activeCertificate.event.durationHours} Hours</p>
                </div>
                
                <div className="text-center">
                  <div className="w-10 h-10 mx-auto bg-[#76A854] rounded-full flex items-center justify-center text-white mb-2 shadow-md">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-gray-800">Location</p>
                  <p className="text-xs text-gray-500 truncate max-w-[100px]">{activeCertificate.event.location?.split(',')[0] || 'Remote'}</p>
                </div>
              </div>
              
              {/* Very Bottom Footer */}
              <div className="flex justify-between items-end px-4">
                {/* Signature */}
                <div className="text-left w-48">
                  <p className="font-['Great_Vibes'] text-2xl text-[#0A1A3B] border-b border-gray-300 pb-1 mb-1" style={{ fontFamily: "'Great Vibes', cursive" }}>Kindera Team</p>
                  <p className="text-[10px] font-bold text-[#0A1A3B]">Kindera Team</p>
                  <p className="text-[10px] text-gray-500">On behalf of Kindera</p>
                </div>
                
                {/* Powered By */}
                <div className="text-center pb-2">
                  <p className="text-[8px] font-bold tracking-widest text-gray-500 uppercase mb-2">POWERED BY</p>
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/kindera-logo.png" alt="Kindera" className="h-10 object-contain mix-blend-multiply" />
                  </div>
                </div>
                
                {/* Badge */}
                <div className="w-48 flex justify-end">
                  <div className="relative w-24 h-24">
                    <div className="absolute inset-0 bg-[#0A1A3B] rounded-full flex items-center justify-center shadow-lg border-2 border-dashed border-white m-1 ring-4 ring-[#0A1A3B]">
                      <div className="text-center bg-white rounded-full w-16 h-16 flex flex-col justify-center items-center p-2">
                         <div className="text-[#76A854] mb-0.5">
                           <svg viewBox="0 0 24 24" className="w-4 h-4 mx-auto" fill="currentColor" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                         </div>
                         <p className="text-[5px] font-bold text-[#0A1A3B] leading-tight mt-1">THANK YOU<br/>FOR MAKING A<br/>DIFFERENCE</p>
                      </div>
                    </div>
                    {/* Ribbons */}
                    <div className="absolute -bottom-3 left-3 w-4 h-8 bg-[#76A854] transform rotate-12 -z-10" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)' }}></div>
                    <div className="absolute -bottom-3 right-3 w-4 h-8 bg-[#76A854] transform -rotate-12 -z-10" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Control buttons inside modal, hidden when printing */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex justify-center gap-3 print:hidden z-[100] w-full max-w-sm">
            <Button
              onClick={() => window.print()}
              className="bg-[#0A1A3B] hover:bg-[#1a2d59] text-white shadow-xl px-8"
            >
              Print / Save PDF
            </Button>
            <Button
              variant="secondary"
              onClick={() => setActiveCertificate(null)}
              className="shadow-xl bg-white text-gray-800 hover:bg-gray-100 border border-gray-200"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
