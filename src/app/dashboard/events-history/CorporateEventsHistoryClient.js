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
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CorporateEventsHistoryClient({ history: initialHistory, userRole }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, upcoming, ended
  const [expandedRows, setExpandedRows] = useState({});

  // Filter logic
  const filtered = initialHistory.filter(item => {
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

      {/* Filters Bar */}
      <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search event..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0d3b26]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
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
                  <th className="px-6 py-3.5 font-semibold">Type</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Expected</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Joined</th>
                  <th className="px-6 py-3.5 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(item => (
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
                      {item.type === 'internal' ? (
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
                      <div className="font-mono font-bold text-emerald-700">
                        {item.joined || 0}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/events/${item._id}`); }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900"
                          title="View Event Details"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {expandedRows[item._id] && item.volunteers?.length > 0 && (
                    <tr className="bg-gray-50/50">
                      <td colSpan="5" className="px-14 py-4">
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
