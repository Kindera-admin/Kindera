'use client';

import { useState, useTransition } from 'react';
import { Clock, CalendarDays, Star, MapPin, TrendingUp, Award, ChevronDown, ChevronUp, CheckCircle2, Loader2 } from 'lucide-react';
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

function EventCard({ event }) {
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
            <h3 className="font-semibold text-gray-900 text-sm leading-snug">{event.title}</h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {saved && (
                <span className="flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Logged
                </span>
              )}
              {!event.isPast && (
                <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">Upcoming</span>
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
          {saved && (
            <div className="flex gap-4 mt-2">
              {event.myHours > 0 && (
                <span className="text-xs text-[#0d3b26] font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {hours || event.myHours}h logged
                </span>
              )}
              {feedback && (
                <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" /> {feedback}/5
                </span>
              )}
            </div>
          )}
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

export default function MyImpactClient({ events, stats }) {
  const pastEvents = events.filter(e => e.isPast);
  const upcomingEvents = events.filter(e => !e.isPast);

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
      <div className="grid grid-cols-3 gap-4 mb-8">
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

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Upcoming Events</h2>
          <div className="space-y-3">
            {upcomingEvents.map(ev => <EventCard key={ev._id} event={ev} />)}
          </div>
        </div>
      )}

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
            {pastEvents.map(ev => <EventCard key={ev._id} event={ev} />)}
          </div>
        )}
      </div>
    </div>
  );
}
