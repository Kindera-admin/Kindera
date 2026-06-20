'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, Users, FileSpreadsheet, Loader2, UploadCloud, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { generateTeamLogins, bulkCreateFromExcel } from '@/app/actions';
import * as XLSX from 'xlsx';
import Link from 'next/link';

export default function GenerateLoginsClient({ role, defaultOrg }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgParam = searchParams.get('org');

  const [activeTab, setActiveTab] = useState('quick');
  const [orgName, setOrgName] = useState(orgParam || defaultOrg || '');
  const [count, setCount] = useState('');
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState(null);
  const [excelFile, setExcelFile] = useState(null);

  const handleQuickGenerate = (e) => {
    e.preventDefault();
    if (!orgName.trim() || !count || count < 1 || count > 500) {
      toast.error('Please enter a valid organisation name and count (1-500)');
      return;
    }

    const fd = new FormData();
    fd.append('orgName', orgName);
    fd.append('count', count);

    startTransition(async () => {
      const res = await generateTeamLogins(fd);
      if (res.success) {
        toast.success(`Generated ${res.credentials.length} logins!`);
        setResults(res.credentials);
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleExcelUpload = (e) => {
    e.preventDefault();
    if (!excelFile || !orgName.trim()) {
      toast.error('Please select an Excel file and enter the organisation name');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { raw: false });

        // Map column names flexibly
        const rows = data.map(row => {
          const name = row['Name'] || row['Employee Name'] || row['Full Name'];
          const username = row['Email'] || row['Username'] || row['Employee ID'];
          return { name, username };
        }).filter(r => r.name); // only keep rows that have a name

        if (rows.length === 0) {
          toast.error('Could not find a "Name" column in the Excel file');
          return;
        }

        startTransition(async () => {
          const res = await bulkCreateFromExcel(rows, orgName);
          if (res.success) {
            toast.success(`Created ${res.credentials.length} accounts from Excel!`);
            setResults(res.credentials);
          } else {
            toast.error(res.message);
          }
        });
      } catch (err) {
        toast.error('Error parsing Excel file');
      }
    };
    reader.readAsBinaryString(excelFile);
  };

  const downloadCSV = () => {
    if (!results) return;
    const header = 'Name,Username,Password\n';
    const csv = results.map(r => `"${r.name}","${r.username}","${r.password}"`).join('\n');
    const blob = new Blob([header + csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${orgName.replace(/\s+/g, '_')}_credentials.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start gap-4">
        <Link href={role === 'admin' ? '/admin/corporate' : '/dashboard/team'} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors mt-1">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">Team Management</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Generate Logins</h1>
          <p className="text-gray-500 text-sm">Bulk create approved accounts for corporate volunteers.</p>
        </div>
      </div>

      {!results ? (
        <div className="border border-gray-100 rounded-2xl bg-white shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setActiveTab('quick')}
              className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'quick' ? 'border-b-2 border-[#0d3b26] text-[#0d3b26]' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <Users className="w-4 h-4" /> Quick Generate
            </button>
            <button
              onClick={() => setActiveTab('excel')}
              className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'excel' ? 'border-b-2 border-[#0d3b26] text-[#0d3b26]' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel Upload
            </button>
          </div>

          <div className="p-6 md:p-8">
            {activeTab === 'quick' ? (
              <form onSubmit={handleQuickGenerate} className="max-w-md mx-auto space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Organisation Name</label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    readOnly={role === 'org_spoc'}
                    className={`w-full h-11 border rounded-lg px-4 text-sm focus:outline-none ${
                      role === 'org_spoc' ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-white border-gray-300 focus:border-[#0d3b26] focus:ring-1 focus:ring-[#0d3b26]'
                    }`}
                    placeholder="e.g. Tata Consultancy Services"
                  />
                  {role === 'org_spoc' && <p className="text-xs text-gray-400 mt-1.5">Fixed to your organisation.</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Number of Logins</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={count}
                    onChange={e => setCount(e.target.value)}
                    className="w-full h-11 border border-gray-300 rounded-lg px-4 text-sm focus:outline-none focus:border-[#0d3b26] focus:ring-1 focus:ring-[#0d3b26]"
                    placeholder="How many volunteers?"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isPending || !orgName || !count}
                  className="w-full h-11 bg-[#0d3b26] hover:bg-[#1a5c3a] text-white gap-2 mt-4 text-base"
                >
                  {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
                  {isPending ? 'Generating...' : 'Generate Accounts'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleExcelUpload} className="max-w-md mx-auto space-y-5">
                {role === 'admin' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Organisation Name</label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={e => setOrgName(e.target.value)}
                      className="w-full h-11 border border-gray-300 rounded-lg px-4 text-sm focus:outline-none focus:border-[#0d3b26] focus:ring-1 focus:ring-[#0d3b26]"
                      placeholder="e.g. Tata Consultancy Services"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Upload Excel (.xlsx)</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors">
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={e => setExcelFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="excel-upload"
                    />
                    <label htmlFor="excel-upload" className="cursor-pointer flex flex-col items-center">
                      <UploadCloud className="w-10 h-10 text-[#2e7d52] mb-3" />
                      <span className="text-sm font-medium text-gray-900 mb-1">Click to browse or drag file</span>
                      <span className="text-xs text-gray-500">Must contain a &quot;Name&quot; column</span>
                      {excelFile && (
                        <span className="mt-4 px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                          Selected: {excelFile.name}
                        </span>
                      )}
                    </label>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={isPending || !excelFile || !orgName}
                  className="w-full h-11 bg-[#0d3b26] hover:bg-[#1a5c3a] text-white gap-2 mt-4 text-base"
                >
                  {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
                  {isPending ? 'Processing...' : 'Create from Excel'}
                </Button>
              </form>
            )}
          </div>
        </div>
      ) : (
        /* Results View */
        <div className="border border-green-200 bg-green-50 rounded-2xl p-6 md:p-8 text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Successfully Generated!</h2>
          <p className="text-gray-600 text-sm mb-8">
            {results.length} accounts have been created for {orgName}. Download the credentials now — passwords are not stored in plain text and cannot be recovered later.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={downloadCSV}
              className="h-12 px-8 bg-[#0d3b26] hover:bg-[#1a5c3a] text-white gap-2 text-base font-semibold w-full sm:w-auto"
            >
              <Download className="w-5 h-5" />
              Download CSV
            </Button>
            <Button
              onClick={() => router.push(role === 'admin' ? '/admin/corporate' : '/dashboard/team')}
              variant="outline"
              className="h-12 px-8 gap-2 text-base font-semibold w-full sm:w-auto"
            >
              Back to Team
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
