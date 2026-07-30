'use client';

import { useState } from 'react';
import { Download, Search, Building2, User, Mail, Phone, CalendarDays, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function DirectoryClient({ spocs, ngos }) {
  const [activeTab, setActiveTab] = useState('spocs');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSpocs = spocs.filter(s => 
    (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.organizationName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredNgos = ngos.filter(n => 
    (n.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (n.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (n.ngoId || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (activeTab === 'spocs') {
      csvContent += "Name,Email,Mobile,Organization,Status,Total Members,Total Hours,Events Attended,Joined At\n";
      filteredSpocs.forEach(s => {
        const row = [
          `"${s.name || ''}"`,
          `"${s.email || ''}"`,
          `"${s.mobile || ''}"`,
          `"${s.organizationName || ''}"`,
          `"${s.status || ''}"`,
          s.memberCount || 0,
          s.volunteerHours || 0,
          s.eventsAttended || 0,
          `"${s.joinedAt ? new Date(s.joinedAt).toLocaleDateString() : ''}"`
        ];
        csvContent += row.join(",") + "\n";
      });
    } else {
      csvContent += "NGO Name,Email,Mobile,NGO ID,Status,Events Created,Joined At\n";
      filteredNgos.forEach(n => {
        const row = [
          `"${n.name || ''}"`,
          `"${n.email || ''}"`,
          `"${n.mobile || ''}"`,
          `"${n.ngoId || ''}"`,
          `"${n.status || ''}"`,
          n.eventsCreated || 0,
          `"${n.joinedAt ? new Date(n.joinedAt).toLocaleDateString() : ''}"`
        ];
        csvContent += row.join(",") + "\n";
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activeTab}_directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="pb-16 font-sans text-gray-900">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">Admin</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Detailed Directory & Reports</h1>
          <p className="text-gray-500 text-sm">Comprehensive listing of all Corporate SPOCs and NGO Partners.</p>
        </div>
        <Button onClick={handleExportCSV} className="bg-[#0d3b26] hover:bg-[#1a5c3a] text-white flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('spocs')}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'spocs' 
              ? 'border-[#0d3b26] text-[#0d3b26]' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Corporate SPOCs ({spocs.length})
        </button>
        <button
          onClick={() => setActiveTab('ngos')}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'ngos' 
              ? 'border-[#0d3b26] text-[#0d3b26]' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          NGO Partners ({ngos.length})
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder={`Search ${activeTab === 'spocs' ? 'SPOCs or organizations' : 'NGOs or IDs'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 bg-gray-50/50"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50/50 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
              {activeTab === 'spocs' ? (
                <tr>
                  <th className="px-6 py-4 rounded-tl-lg">Organization</th>
                  <th className="px-6 py-4">SPOC Info</th>
                  <th className="px-6 py-4 text-center">Members</th>
                  <th className="px-6 py-4 text-center">Hours</th>
                  <th className="px-6 py-4 text-center">Events</th>
                  <th className="px-6 py-4 rounded-tr-lg">Status</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-4 rounded-tl-lg">NGO Name</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4">NGO ID</th>
                  <th className="px-6 py-4 text-center">Events</th>
                  <th className="px-6 py-4 rounded-tr-lg">Status</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeTab === 'spocs' && filteredSpocs.map(spoc => (
                <tr key={spoc._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#0d3b26] flex items-center justify-center text-white font-bold text-xs">
                        {(spoc.organizationName || 'C').charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-gray-900">{spoc.organizationName || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900 flex items-center gap-1"><User className="w-3 h-3 text-gray-400"/> {spoc.name}</p>
                    <p className="text-gray-500 text-xs flex items-center gap-1 mt-1"><Mail className="w-3 h-3"/> {spoc.email}</p>
                    {spoc.mobile && spoc.mobile !== '-' && (
                      <p className="text-gray-500 text-xs flex items-center gap-1 mt-1"><Phone className="w-3 h-3"/> {spoc.mobile}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center bg-blue-50 text-blue-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                      {spoc.memberCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                      {spoc.volunteerHours.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center bg-purple-50 text-purple-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                      {spoc.eventsAttended}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      spoc.status === 'approved' ? 'bg-green-100 text-green-700' :
                      spoc.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {spoc.status || 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}

              {activeTab === 'ngos' && filteredNgos.map(ngo => (
                <tr key={ngo._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                        {(ngo.name || 'N').charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-gray-900">{ngo.name || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-900 text-sm flex items-center gap-1 mb-1"><Mail className="w-3 h-3 text-gray-400"/> {ngo.email}</p>
                    {ngo.mobile && ngo.mobile !== '-' && (
                      <p className="text-gray-500 text-xs flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400"/> {ngo.mobile}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                      {ngo.ngoId || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center bg-purple-50 text-purple-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                      {ngo.eventsCreated}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      ngo.status === 'approved' ? 'bg-green-100 text-green-700' :
                      ngo.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {ngo.status || 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
              
              {((activeTab === 'spocs' && filteredSpocs.length === 0) || 
                (activeTab === 'ngos' && filteredNgos.length === 0)) && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    No {activeTab === 'spocs' ? 'Corporate SPOCs' : 'NGOs'} found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
