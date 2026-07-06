'use client';

import { useRouter } from 'next/navigation';
import { CalendarDays, MapPin, Clock, ChevronRight, ClipboardCheck } from 'lucide-react';

export default function AttendanceIndexClient({ events }) {
  const router = useRouter();

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">Dashboard</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Mark Attendance</h1>
        <p className="text-gray-500 text-sm">Select an event to mark attendance for your team members.</p>
      </div>

      {events.length === 0 ? (
        <div className="border border-gray-100 rounded-2xl bg-white shadow-sm p-16 text-center">
          <ClipboardCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No events found. Create an event first.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((event) => (
            <button
              key={event._id}
              onClick={() => router.push(`/dashboard/attendance/${event._id}`)}
              className="group border border-gray-100 rounded-2xl bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-5 text-left flex items-center gap-4"
            >
              {/* Status colour dot */}
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${
                event.lifecycle === 'live' ? 'bg-green-500' :
                event.lifecycle === 'ended' ? 'bg-gray-400' : 'bg-blue-500'
              }`} />

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{event.title}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {new Date(event.date).toLocaleDateString('en-IN', {
                      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </span>
                  {event.location && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {event.location}
                    </span>
                  )}
                  {event.durationHours && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {event.durationHours}h
                    </span>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                event.lifecycle === 'live' ? 'bg-green-100 text-green-700' :
                event.lifecycle === 'ended' ? 'bg-gray-100 text-gray-500' :
                'bg-blue-100 text-blue-700'
              }`}>
                {event.lifecycle === 'live' ? 'Live' :
                 event.lifecycle === 'ended' ? 'Ended' : 'Upcoming'}
              </span>

              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#0d3b26] transition-colors flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
