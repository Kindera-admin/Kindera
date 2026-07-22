'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, MapPin, Users, Check, Save, Loader2, ChevronLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { markAttendance, getOrgMembers } from '@/app/actions';
import Link from 'next/link';

export default function AttendanceClient({ event, initialRecords, orgName }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [records, setRecords] = useState(initialRecords);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // If this is an org_spoc, always fetch their team members and merge with existing records
  useEffect(() => {
    if (orgName !== 'All Organizations') {
      setLoadingMembers(true);
      getOrgMembers(orgName).then(res => {
        if (res.success) {
          const initialMap = {};
          initialRecords.forEach(r => initialMap[r.userId] = r);
          
          const merged = res.members.map(m => {
            const existing = initialMap[m._id];
            return {
              userId: m._id,
              name: m.name,
              username: m.username,
              attended: existing ? existing.attended : false,
              hoursContributed: existing ? existing.hoursContributed : 0,
              feedbackScore: existing ? existing.feedbackScore : null,
            };
          });
          setRecords(merged);
        }
        setLoadingMembers(false);
      });
    }
  }, [orgName, initialRecords]);

  const handleToggleAttendance = (userId) => {
    setRecords(prev => prev.map(r => {
      if (r.userId === userId) {
        const newAttended = !r.attended;
        return { ...r, attended: newAttended };
      }
      return r;
    }));
  };



  const handleSave = () => {
    startTransition(async () => {
      const payload = records.map(r => ({
        userId: r.userId,
        organizationName: orgName,
        attended: r.attended,
        hoursContributed: r.hoursContributed,
        feedbackScore: r.feedbackScore,
      }));

      const res = await markAttendance(event._id, payload);
      if (res.success) {
        toast.success('Attendance marked successfully!');
        router.push('/dashboard/team');
      } else {
        toast.error(res.message);
      }
    });
  };

  const filtered = records.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const attendedCount = records.filter(r => r.attended).length;
  const totalHours = records.reduce((s, r) => s + (r.attended ? r.hoursContributed : 0), 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <Link href="/dashboard/team" className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors mt-1">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">Mark Attendance</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {new Date(event.date).toLocaleDateString()}</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {event.location}</span>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={isPending || loadingMembers}
          className="bg-[#0d3b26] hover:bg-[#1a5c3a] text-white gap-2 shadow-md hidden sm:flex"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Attendance
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8 max-w-sm">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Attended</p>
          <p className="text-3xl font-bold text-[#0d3b26]">{attendedCount} <span className="text-lg text-green-600 font-medium">/ {records.length}</span></p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Total Hours</p>
          <p className="text-3xl font-bold text-blue-900">{totalHours}</p>
        </div>
      </div>

      {/* Main List */}
      <div className="border border-gray-100 rounded-2xl bg-white shadow-sm overflow-hidden mb-20 sm:mb-0">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search team members..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0d3b26]"
            />
          </div>
        </div>

        {loadingMembers ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#2e7d52] mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading team members...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No members to show.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-3 text-left w-16">Status</th>
                  <th className="px-6 py-3 text-left">Member</th>
                  <th className="px-6 py-3 text-right w-32">Hours Logged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => (
                  <tr 
                    key={r.userId} 
                    className={`transition-colors ${r.attended ? 'bg-green-50/30 hover:bg-green-50/50' : 'hover:bg-gray-50/60'}`}
                  >
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleAttendance(r.userId)}
                        className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                          r.attended ? 'bg-[#0d3b26] text-white' : 'bg-gray-100 border border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {r.attended && <Check className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-6 py-4 cursor-pointer" onClick={() => handleToggleAttendance(r.userId)}>
                      <p className="font-semibold text-gray-900 text-sm">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.username}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {r.attended ? (
                        <span className="font-semibold text-[#0d3b26]">{r.hoursContributed}h</span>
                      ) : (
                        <span className="text-gray-300 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile Sticky Save Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 sm:hidden z-10">
        <Button
          onClick={handleSave}
          disabled={isPending || loadingMembers}
          className="w-full bg-[#0d3b26] hover:bg-[#1a5c3a] text-white gap-2 shadow-lg h-12 text-base"
        >
          {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save Attendance
        </Button>
      </div>
    </div>
  );
}
