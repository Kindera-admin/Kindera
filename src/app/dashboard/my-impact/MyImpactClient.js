'use client';

import { useState, useTransition } from 'react';
import { Award, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Clock, Loader2, MapPin, Star, Activity, Globe, Building2 } from 'lucide-react';
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
  const [saved, setSaved] = useState(event.attended && event.myHours > 0);

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

  const dateStr = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div className={`border rounded-xl bg-white shadow-sm overflow-hidden transition-all duration-200 ${event.isPast ? 'border-gray-100' : 'border-emerald-100'}`}>
      <div className="flex items-start gap-4 p-5">
        {/* Date badge */}
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center text-center ${event.isPast ? 'bg-gray-100' : 'bg-emerald-50'}`}>
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${event.isPast ? 'text-gray-400' : 'text-emerald-600'}`}>
            {new Date(event.date).toLocaleString('default', { month: 'short' })}
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
          event.attended ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex-shrink-0 text-xs font-semibold text-[#0d3b26] hover:text-emerald-600 flex items-center gap-1 transition-colors"
            >
              {saved ? 'Edit' : 'Log Hours'}
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="flex-shrink-0 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100/60 flex items-center gap-1">
              Pending Attendance
            </span>
          )
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
    <div className="w-full max-w-3xl mx-auto">
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
                      {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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

      {/* Certificate Modal */}
      {activeCertificate && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:p-0 print:static print:bg-white">
          <div className="bg-[#fffdf9] border-[12px] double border-[#0d3b26] p-8 md:p-12 max-w-2xl w-full text-center relative rounded-lg print:border-[12px] print:shadow-none shadow-2xl" id="certificate-print-area">
            {/* Elegant corner decorations */}
            <div className="absolute top-2 left-2 right-2 bottom-2 border border-emerald-800/20 pointer-events-none" />
            
            <div className="py-4 md:py-8">
              <span className="text-[#2e7d52] font-semibold tracking-widest text-xs uppercase block mb-4">Kindera Impact Network</span>
              <h1 className="text-2xl md:text-3xl font-serif text-[#0d3b26] mb-2 font-bold">Certificate of Appreciation</h1>
              <p className="text-[10px] text-gray-400 tracking-wider uppercase mb-8">Proudly Presented To</p>
              
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 border-b border-gray-200 pb-2 max-w-md mx-auto mb-6 font-serif">{activeCertificate.userName}</h2>
              
              <p className="text-gray-600 max-w-lg mx-auto text-sm leading-relaxed mb-8">
                for outstanding volunteer service and dedication to community development. Your contribution of <strong className="text-[#0d3b26]">{activeCertificate.event.myHours || activeCertificate.event.durationHours} Hours</strong> at the event <strong className="text-[#0d3b26]">&ldquo;{activeCertificate.event.title}&rdquo;</strong> on {new Date(activeCertificate.event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} has made a meaningful difference.
              </p>
              
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-gray-100 max-w-md mx-auto">
                <div>
                  <p className="text-sm font-bold text-gray-800 border-b border-gray-300 pb-1 max-w-[120px] mx-auto font-serif">Kindera Team</p>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase">Organiser</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800 border-b border-gray-300 pb-1 max-w-[120px] mx-auto font-serif">{new Date().toLocaleDateString('en-IN')}</p>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase">Date Issued</p>
                </div>
              </div>
            </div>
            
            {/* Control buttons inside modal, hidden when printing */}
            <div className="mt-8 flex justify-center gap-3 print:hidden">
              <Button
                onClick={() => window.print()}
                className="bg-[#0d3b26] hover:bg-[#1a5c3a] text-white"
              >
                Print / Save PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveCertificate(null)}
              >
                Close
              </Button>
            </div>
          </div>
          
          {/* Print helper style to hide everything else during print */}
          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #certificate-print-area, #certificate-print-area * {
                visibility: visible;
              }
              #certificate-print-area {
                position: fixed;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
                width: 100%;
                max-width: 90%;
                border: 16px double #0d3b26 !important;
                box-shadow: none !important;
                margin: 0;
                padding: 3rem;
                background: #fffdf9 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .print\\:hidden {
                display: none !important;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
