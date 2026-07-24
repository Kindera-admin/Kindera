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
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteEvent } from '@/app/actions';
import { toast } from 'sonner';
import ConfirmModal from '@/components/ConfirmModal';
import EventDetailsModal from './EventDetailsModal';

export default function EventsHistoryClient({ history: initialHistory, userRole }) {
  const router = useRouter();
  const [history, setHistory] = useState(initialHistory);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all, global, internal
  const [statusFilter, setStatusFilter] = useState('all'); // all, upcoming, ended, live
  const [expandedRows, setExpandedRows] = useState({});

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewDetailsId, setViewDetailsId] = useState(null);

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const canDelete = userRole === 'admin';

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    const res = await deleteEvent(confirmDelete.id);
    if (res.success) {
      setHistory(prev => prev.filter(e => e._id !== confirmDelete.id));
      toast.success('Event deleted successfully');
    } else {
      toast.error(res.message || 'Failed to delete event');
    }
    setIsDeleting(false);
    setConfirmDelete(null);
  };

  // Filter logic
  const filtered = history.filter(item => {
    const matchesSearch = 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (item.createdBy?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.organizationName || '').toLowerCase().includes(searchTerm.toLowerCase());

    const isInternal = !!item.organizationName;
    const matchesType = 
      typeFilter === 'all' || 
      (typeFilter === 'global' && !isInternal) ||
      (typeFilter === 'internal' && isInternal);

    const matchesStatus = 
      statusFilter === 'all' || 
      item.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  // KPI Calculations
  const totalEvents = filtered.length;
  const totalJoined = filtered.reduce((s, item) => s + (item.joinedCount || 0), 0);
  const totalAttended = filtered.reduce((s, item) => s + (item.attendanceCount || 0), 0);
  const totalHours = filtered.reduce((s, item) => s + (item.hoursLogged || 0), 0);

  return (
    <div>
      {/* Breadcrumb & Header */}
      <div className="mb-8">
        <button 
          onClick={() => router.push('/dashboard')} 
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dashboard
        </button>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">Admin Panel</p>
            <h1 className="text-3xl font-bold text-gray-900 mb-1 font-serif">All Events History</h1>
            <p className="text-gray-500 text-sm">
              Complete analytics and historical overview of all global and internal corporate events.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Events', value: totalEvents, icon: Calendar, color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Volunteers Registered', value: totalJoined.toLocaleString(), icon: Users, color: 'text-blue-700 bg-blue-50' },
          { label: 'Attendance Marked', value: totalAttended.toLocaleString(), icon: Award, color: 'text-purple-700 bg-purple-50' },
          { label: 'Volunteer Hours', value: totalHours.toLocaleString() + 'h', icon: Clock, color: 'text-amber-700 bg-amber-50' },
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

      {/* Filters Bar */}
      <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search event, creator or organisation..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0d3b26]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-semibold uppercase">Type</span>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="h-9 text-xs border border-gray-200 rounded-lg px-2 bg-white focus:outline-none focus:border-[#0d3b26]"
            >
              <option value="all">All Types</option>
              <option value="global">Global Events Only</option>
              <option value="internal">Internal Corp Only</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-semibold uppercase">Status</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-9 text-xs border border-gray-200 rounded-lg px-2 bg-white focus:outline-none focus:border-[#0d3b26]"
            >
              <option value="all">All Status</option>
              <option value="upcoming">Upcoming</option>
              <option value="ended">Ended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">History Records ({filtered.length})</h2>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No historical events match the filter parameters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-3.5 font-semibold">Event</th>
                  <th className="px-6 py-3.5 font-semibold">Created By</th>
                  <th className="px-6 py-3.5 font-semibold">Type</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Joined</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Attended</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Hours Logged</th>
                  <th className="px-6 py-3.5 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(item => (
                  <React.Fragment key={item._id}>
                  <tr 
                    onClick={() => item.corporateDetails?.length > 0 && toggleRow(item._id)}
                    className={`hover:bg-gray-50/50 transition-colors text-sm text-gray-700 ${item.corporateDetails?.length > 0 ? 'cursor-pointer' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        {item.corporateDetails?.length > 0 ? (
                          <div className="mt-0.5 text-gray-400">
                            {expandedRows[item._id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        ) : (
                          <div className="w-4 h-4" /> // placeholder
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
                      {item.createdBy ? (
                        <div>
                          <span className="font-medium text-gray-800 block">{item.createdBy.name}</span>
                          <span className="text-[10px] text-gray-400 capitalize block leading-none mt-0.5">
                            {item.createdBy.role === 'org_spoc' ? 'SPOC' : item.createdBy.role} 
                            {item.createdBy.organizationName ? ` (${item.createdBy.organizationName})` : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Unknown</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {item.organizationName ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <Building2 className="w-3 h-3" />
                          {item.organizationName}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          <Globe className="w-3 h-3" />
                          Global Event
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="font-mono font-medium text-gray-900">{item.joinedCount} <span className="font-sans text-xs text-gray-500 font-normal">volunteers</span></div>
                      {(item.spocCount > 0) && (
                        <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">
                          from {item.spocCount} SPOC{item.spocCount > 1 ? 's' : ''}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right font-mono font-medium text-emerald-700">
                      {item.attendanceCount}
                    </td>

                    <td className="px-6 py-4 text-right font-mono font-bold text-[#0d3b26]">
                      {item.hoursLogged.toLocaleString()} hrs
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewDetailsId(item._id); }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900"
                          title="View Event Details"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => setConfirmDelete({ id: item._id, title: item.title })}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete Event"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedRows[item._id] && item.corporateDetails?.length > 0 && (
                    <tr className="bg-gray-50/30">
                      <td colSpan="7" className="px-12 py-4">
                        <div className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
                          <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-emerald-700" />
                            Corporate Breakdown
                          </h4>
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="text-gray-500 border-b border-gray-100">
                                <th className="pb-2 font-medium">Organization Name</th>
                                <th className="pb-2 font-medium text-right">Expected Volunteers</th>
                                <th className="pb-2 font-medium text-right">Actual Joined</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {item.corporateDetails.map((corp, idx) => (
                                <tr key={idx} className="text-gray-700">
                                  <td className="py-2.5 font-medium">{corp.orgName}</td>
                                  <td className="py-2.5 text-right font-mono text-gray-500">{corp.expected}</td>
                                  <td className="py-2.5 text-right font-mono font-medium text-emerald-700">{corp.actual}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => !isDeleting && setConfirmDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Event"
        message={`Are you sure you want to delete "${confirmDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete Event"
        isLoading={isDeleting}
      />

      <EventDetailsModal 
        eventId={viewDetailsId} 
        onClose={() => setViewDetailsId(null)} 
      />
    </div>
  );
}
