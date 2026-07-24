import React, { useEffect, useState } from 'react';
import { X, Calendar, Clock, MapPin, Users, Building2, User, Loader2, Star, Target } from 'lucide-react';
import { getAdminEventDetails } from '@/app/actions';

export default function EventDetailsModal({ eventId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!eventId) return;
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      const res = await getAdminEventDetails(eventId);
      if (mounted) {
        if (res.success) {
          setData(res);
        } else {
          setError(res.message || 'Failed to load event details.');
        }
        setLoading(false);
      }
    }
    loadData();

    return () => { mounted = false; };
  }, [eventId]);

  if (!eventId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-900">Event Details</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-[#0d3b26]" />
              <p>Loading event details...</p>
            </div>
          ) : error ? (
            <div className="py-20 text-center text-red-500 bg-red-50 rounded-xl">
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : data ? (
            <div className="space-y-8">
              {/* Event Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{data.event.title}</h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                      {data.event.status.toUpperCase()}
                    </span>
                    {data.event.organizationName ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        {data.event.organizationName}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        Global Event
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm whitespace-pre-wrap">{data.event.description}</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                    <span className="font-medium">{new Date(data.event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <span className="font-medium">{data.event.durationHours} hours</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <MapPin className="w-5 h-5 text-red-600" />
                    <span className="font-medium">{data.event.location}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <Target className="w-5 h-5 text-amber-600" />
                    <span className="font-medium">Impact: {data.event.beneficiariesImpacted || 0} beneficiaries</span>
                  </div>
                  {data.event.createdBy && (
                    <div className="pt-3 border-t border-gray-200 mt-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">Created By</p>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {data.event.createdBy.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 leading-tight">{data.event.createdBy.name}</p>
                          <p className="text-[11px] text-gray-500 capitalize">{data.event.createdBy.role}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Roster / Participants */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">
                  Volunteer Roster ({data.participants.length})
                </h3>
                {data.participants.length === 0 ? (
                  <p className="text-gray-500 text-sm italic">No volunteers have joined this event yet.</p>
                ) : (
                  <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                          <th className="px-4 py-3 font-semibold">Volunteer Name</th>
                          <th className="px-4 py-3 font-semibold">Organization</th>
                          <th className="px-4 py-3 font-semibold">Attendance</th>
                          <th className="px-4 py-3 font-semibold">Hours</th>
                          <th className="px-4 py-3 font-semibold">Feedback</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data.participants.map(p => (
                          <tr key={p._id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{p.name}</p>
                              <p className="text-[11px] text-gray-400">{p.email}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-medium bg-gray-100 px-2 py-0.5 rounded-full text-gray-700">
                                {p.organizationName || 'None'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {p.attended ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-xs bg-emerald-50 px-2 py-1 rounded-md">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Attended
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-gray-400 font-medium text-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300" /> Pending
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-700">{p.hoursContributed}h</td>
                            <td className="px-4 py-3">
                              {p.feedbackScore ? (
                                <div className="flex items-center gap-1 text-amber-500 font-medium">
                                  <Star className="w-3.5 h-3.5 fill-amber-500" /> {p.feedbackScore}/5
                                </div>
                              ) : (
                                <span className="text-gray-300 text-xs">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
