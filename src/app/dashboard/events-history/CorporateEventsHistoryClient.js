'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar, 
  MapPin, 
  Users, 
  Clock, 
  Search, 
  FileText, 
  ArrowLeft, 
  Info, 
  Filter, 
  Building2, 
  Award,
  Globe,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Eye,
  Trash2,
  CalendarDays
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import EventDetailsModal from '../../admin/events-history/EventDetailsModal';
import ConfirmModal from '@/components/ConfirmModal';
import { deleteEvent } from '@/app/actions';
import { toast } from 'sonner';

export default function CorporateEventsHistoryClient({ history: initialHistory, userRole, currentUserId }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, upcoming, ended
  const [expandedRows, setExpandedRows] = useState({});
  const [viewDetailsId, setViewDetailsId] = useState(null);
  const [events, setEvents] = useState(initialHistory);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    const result = await deleteEvent(confirmDelete.id);
    if (result.success) {
      setEvents(prev => prev.filter(e => e._id !== confirmDelete.id));
      toast.success('Event deleted');
    } else {
      toast.error(result.message || 'Failed to delete event');
    }
    setIsDeleting(false);
    setConfirmDelete(null);
  };

  // Filter logic
  const filtered = events.filter(item => {
    const matchesSearch = 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (item.createdBy?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.organizationName || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalEvents = initialHistory.length;
  const totalJoined = initialHistory.reduce((acc, curr) => acc + (curr.joined || 0), 0);
  const totalExpected = initialHistory.reduce((acc, curr) => acc + (curr.expected || 0), 0);

  const toggleRow = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => router.back()} className="shrink-0 text-gray-500 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Organization&apos;s Event History</h1>
          <p className="text-gray-500 text-sm mt-1">Review events your organization has participated in.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Events', value: totalEvents, icon: Calendar, color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Volunteers Expected', value: totalExpected.toLocaleString(), icon: Users, color: 'text-blue-700 bg-blue-50' },
          { label: 'Volunteers Joined', value: totalJoined.toLocaleString(), icon: Award, color: 'text-purple-700 bg-purple-50' },
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="border border-gray-100 rounded-2xl p-5 bg-white shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{card.label}</span>
                <div className={`p-2 rounded-xl ${card.color} shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search by event or location..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-gray-50 border-none rounded-xl text-sm font-medium text-gray-700 focus:ring-2 focus:ring-emerald-500/20 outline-none appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
          >
            <option value="all">All Status</option>
            <option value="upcoming">Upcoming</option>
            <option value="live">Live</option>
            <option value="ended">Ended</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center">
            <CalendarDays className="w-12 h-12 text-gray-200 mb-3" />
            <p>No events found matching your criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-3.5 font-semibold">Event</th>
                  <th className="px-6 py-3.5 font-semibold">Type</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Expected</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Joined</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Attended</th>
                  <th className="px-6 py-3.5 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(item => {
                  const attendedCount = item.volunteers ? item.volunteers.filter(v => v.attended).length : 0;
                  const canDelete = item.createdBy === currentUserId;
                  
                  return (
                    <React.Fragment key={item._id}>
                      <tr 
                        onClick={() => item.volunteers?.length > 0 && toggleRow(item._id)}
                        className={`hover:bg-gray-50/50 transition-colors text-sm text-gray-700 ${item.volunteers?.length > 0 ? 'cursor-pointer' : ''}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            {item.volunteers?.length > 0 ? (
                              <div className="mt-0.5 text-gray-400">
                                {expandedRows[item._id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </div>
                            ) : (
                              <div className="w-4 h-4" />
                            )}
                            <div>
                              <span className="font-semibold text-gray-900 block leading-tight mb-1">{item.title}</span>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                <span className={`px-1.5 py-0.5 rounded-full font-bold ${
                                  item.status === 'upcoming' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {item.status.toUpperCase()}
                                </span>
                                <span>·</span>
                                <span>{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          {item.organizationName ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              <Building2 className="w-3 h-3" />
                              Internal Event
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                              <Globe className="w-3 h-3" />
                              Global Event
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="font-mono text-gray-500">
                            {item.expected || 0}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="font-mono font-medium text-gray-900">
                            {item.joined || 0}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="font-mono font-bold text-emerald-700">
                            {attendedCount}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setViewDetailsId(item._id); }}
                              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900"
                              title="View Event Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: item._id, title: item.title }); }}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete Event"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      
                      {expandedRows[item._id] && item.volunteers?.length > 0 && (
                        <tr className="bg-gray-50/50">
                          <td colSpan="6" className="px-14 py-4">
                            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Volunteers from your organization</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {item.volunteers.map(vol => (
                                  <div key={vol.id} className="flex items-center justify-between p-2 rounded-lg border border-gray-50 bg-gray-50">
                                    <span className="text-sm font-medium text-gray-700 truncate mr-2" title={vol.name}>{vol.name}</span>
                                    {vol.attended ? (
                                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full shrink-0">
                                        <CheckCircle2 className="w-3 h-3" /> Attended
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full shrink-0">
                                        <XCircle className="w-3 h-3" /> No Show
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EventDetailsModal 
        eventId={viewDetailsId} 
        onClose={() => setViewDetailsId(null)} 
      />

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => !isDeleting && setConfirmDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Event"
        message={`Are you sure you want to delete "${confirmDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete Event"
        isLoading={isDeleting}
      />
    </div>
  );
}
