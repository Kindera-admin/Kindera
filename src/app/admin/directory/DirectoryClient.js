'use client';

import { useState, useTransition, Fragment } from 'react';
import { Download, Search, Building2, User, Mail, Phone, CalendarDays, Clock, FileText, Loader2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { exportDetailedAttendanceData } from '@/app/actions';

export default function DirectoryClient({ spocs, ngos }) {
  const [activeTab, setActiveTab] = useState('spocs');
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, startTransition] = useTransition();
  const [expandedRows, setExpandedRows] = useState({});

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTarget, setExportTarget] = useState(null);
  const [exportYear, setExportYear] = useState(new Date().getFullYear().toString());
  const [exportQuarter, setExportQuarter] = useState('All Year');
  const formatDateStr = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-US', { 
        timeZone: 'Asia/Kolkata',
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      });
    } catch {
      return dateStr;
    }
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExportIndividualCSV = (orgName) => {
    setExportTarget(orgName);
    setShowExportModal(true);
  };

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
      csvContent += "Name,Username,Mobile,Organization,Status,Total Members,Total Hours,Events Attended,Joined At\n";
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
          `"${s.joinedAt ? new Date(s.joinedAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''}"`
        ];
        csvContent += row.join(",") + "\n";
      });
    } else {
      csvContent += "NGO Name,Username,Mobile,NGO ID,Status,Events Created,Joined At\n";
      filteredNgos.forEach(n => {
        const row = [
          `"${n.name || ''}"`,
          `"${n.email || ''}"`,
          `"${n.mobile || ''}"`,
          `"${n.ngoId || ''}"`,
          `"${n.status || ''}"`,
          n.eventsCreated || 0,
          `"${n.joinedAt ? new Date(n.joinedAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''}"`
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

  const handleExportDetailedCSV = () => {
    setExportTarget('all');
    setShowExportModal(true);
  };

  const executeDetailedExport = () => {
    startTransition(async () => {
      const orgName = exportTarget === 'all' ? null : exportTarget;
      const res = await exportDetailedAttendanceData(orgName, exportYear, exportQuarter);
      if (!res.success) {
        alert('Failed to export data: ' + res.message);
        return;
      }
      
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Organization,Volunteer Name,Volunteer Username,Event Title,Event Date,Event Location,Hours Contributed,Feedback Score,Feedback Text,Marked At\n";
      
      res.data.forEach(r => {
        const row = [
          `"${r.organizationName}"`,
          `"${r.volunteerName}"`,
          `"${r.volunteerEmail}"`,
          `"${r.eventTitle.replace(/"/g, '""')}"`,
          `"${formatDateStr(r.eventDate)}"`,
          `"${r.eventLocation.replace(/"/g, '""')}"`,
          r.hoursContributed,
          r.feedbackScore,
          `"${r.feedbackText.replace(/"/g, '""')}"`,
          `"${formatDateStr(r.markedAt)}"`
        ];
        csvContent += row.join(",") + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      let filename = orgName ? `${orgName.replace(/\s+/g, '_')}_attendance` : 'detailed_attendance_data';
      filename += `_${exportYear}`;
      if (exportQuarter !== 'All Year') filename += `_${exportQuarter}`;
      filename += `_${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowExportModal(false);
    });
  };

  return (
    <div className="pb-16 font-sans text-gray-900">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">Admin</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Detailed Directory & Reports</h1>
          <p className="text-gray-500 text-sm">Comprehensive listing of all Corporate SPOCs and NGO Partners.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleExportDetailedCSV} 
            disabled={isExporting}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Master Attendance CSV
          </Button>
          <Button onClick={handleExportCSV} className="bg-[#0d3b26] hover:bg-[#1a5c3a] text-white flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Current Tab
          </Button>
        </div>
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
                  <th className="px-4 py-4 rounded-tl-lg w-10"></th>
                  <th className="px-6 py-4">Organization</th>
                  <th className="px-6 py-4">SPOC Info</th>
                  <th className="px-6 py-4 text-center">Members</th>
                  <th className="px-6 py-4 text-center">Hours</th>
                  <th className="px-6 py-4 text-center">Events</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 rounded-tr-lg text-right">Actions</th>
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
                <Fragment key={spoc._id}>
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-4">
                      <button 
                        onClick={() => toggleRow(spoc._id)}
                        className="p-1 rounded hover:bg-gray-200 text-gray-500 transition-colors"
                      >
                        {expandedRows[spoc._id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
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
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        spoc.status === 'approved' ? 'bg-green-100 text-green-700' :
                        spoc.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {spoc.status || 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        title="Download Attendance Data"
                        onClick={() => handleExportIndividualCSV(spoc.organizationName)}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 transition-colors inline-flex"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  
                  {expandedRows[spoc._id] && (
                    <tr className="bg-gray-50/30">
                      <td colSpan={8} className="px-6 py-6 border-b border-gray-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Members ({spoc.memberCount})</h4>
                            <div className="flex flex-wrap gap-2">
                              {spoc.memberNames && spoc.memberNames.length > 0 ? (
                                spoc.memberNames.map((m, idx) => (
                                  <span key={idx} className="bg-white border border-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded-md shadow-sm">
                                    {m}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-400 text-xs italic">No members found</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Events Participated</h4>
                            <div className="flex flex-wrap gap-2">
                              {spoc.eventNames && spoc.eventNames.length > 0 ? (
                                spoc.eventNames.map((eName, idx) => (
                                  <span key={idx} className="bg-blue-50 border border-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-md">
                                    {eName}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-400 text-xs italic">No events attended yet</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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
      
      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">Export Filters</h2>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Year</label>
                <select 
                  className="w-full text-sm border-gray-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                  value={exportYear}
                  onChange={(e) => setExportYear(e.target.value)}
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                  <option value="2023">2023</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Period</label>
                <select 
                  className="w-full text-sm border-gray-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                  value={exportQuarter}
                  onChange={(e) => setExportQuarter(e.target.value)}
                >
                  <option value="All Year">All Year</option>
                  <option value="Q1">Q1 (Jan - Mar)</option>
                  <option value="Q2">Q2 (Apr - Jun)</option>
                  <option value="Q3">Q3 (Jul - Sep)</option>
                  <option value="Q4">Q4 (Oct - Dec)</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <Button variant="outline" onClick={() => setShowExportModal(false)}>Cancel</Button>
              <Button onClick={executeDetailedExport} disabled={isExporting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Download CSV
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
