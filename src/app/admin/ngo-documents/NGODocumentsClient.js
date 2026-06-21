'use client';

import { useState, useTransition, useRef } from 'react';
import {
  FileText, CheckCircle2, XCircle, Clock, ExternalLink,
  Upload, User, Phone, Hash, ChevronDown, ChevronUp, Plus, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { reviewNGODocument, adminUploadNGODocument } from '@/app/actions';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: 'bg-amber-100 text-amber-700 border-amber-200',  icon: Clock },
  verified: { label: 'Verified', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200',        icon: XCircle },
};

const CERT_TYPES = [
  { key: '12A',          label: '12A Certificate' },
  { key: '80G',          label: '80G Certificate' },
  { key: 'FCRA',         label: 'FCRA Certificate' },
  { key: 'registration', label: 'Registration Certificate' },
  { key: 'other',        label: 'Other Document' },
];

const DOC_TYPE_COLORS = {
  '12A':          'bg-blue-50   text-blue-700   border-blue-100',
  '80G':          'bg-purple-50 text-purple-700 border-purple-100',
  'FCRA':         'bg-orange-50 text-orange-700 border-orange-100',
  'registration': 'bg-teal-50   text-teal-700   border-teal-100',
  'other':        'bg-gray-50   text-gray-600   border-gray-100',
};

function AdminUploadPanel({ ngo, onUploaded }) {
  const [docType, setDocType] = useState('registration');
  const [label, setLabel]     = useState('');
  const [file, setFile]       = useState(null);
  const [isPending, start]    = useTransition();
  const ref = useRef(null);

  const handleUpload = () => {
    if (!file || !label.trim()) {
      toast.error('Please select a file and enter a label');
      return;
    }
    start(async () => {
      try {
        // Upload to Cloudinary first
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', 'kindera/ngo-certificates');
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Upload failed');
        const { url } = await res.json();

        // Save to DB via server action
        const result = await adminUploadNGODocument(ngo._id, docType, label.trim(), url);
        if (result.success) {
          toast.success('Document uploaded and auto-verified!');
          setFile(null); setLabel('');
          onUploaded();
        } else {
          toast.error(result.message);
        }
      } catch (err) {
        toast.error(err.message || 'Upload failed');
      }
    });
  };

  return (
    <div className="border border-dashed border-[#0d3b26]/30 rounded-xl p-4 bg-emerald-50/40">
      <p className="text-xs font-semibold text-[#0d3b26] uppercase tracking-widest mb-3 flex items-center gap-1.5">
        <Plus className="w-3.5 h-3.5" /> Upload Certificate for {ngo.name}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select
          value={docType}
          onChange={e => setDocType(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
        >
          {CERT_TYPES.map(ct => <option key={ct.key} value={ct.key}>{ct.label}</option>)}
        </select>
        <input
          type="text"
          placeholder="Document label (e.g. 12A 2024)"
          value={label}
          onChange={e => setLabel(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-left truncate bg-white hover:border-[#0d3b26]/40 transition-colors"
          >
            {file ? <span className="text-emerald-600 truncate">{file.name}</span> : <span className="text-gray-400 flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Choose file</span>}
          </button>
          <input ref={ref} type="file" className="hidden" accept=".pdf,.doc,.docx,image/*"
            onChange={e => setFile(e.target.files[0] || null)} />
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={isPending || !file}
            className="bg-[#0d3b26] hover:bg-[#1a5c3a] text-white flex-shrink-0"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function NGODocumentsClient({ ngos: initial }) {
  const [ngos, setNgos]     = useState(initial);
  const [expanded, setExp]  = useState({});
  const [uploading, setUpl] = useState({});
  const [note, setNote]     = useState({});
  const [isPending, startTransition] = useTransition();

  const totalPending = ngos.reduce((s, n) => s + n.pendingCount, 0);

  const toggle = (id) => setExp(e => ({ ...e, [id]: !e[id] }));
  const toggleUpload = (id) => setUpl(u => ({ ...u, [id]: !u[id] }));

  const handleReview = (ngoId, docId, status) => {
    const adminNote = note[docId] || '';
    startTransition(async () => {
      const res = await reviewNGODocument(ngoId, docId, status, adminNote);
      if (res.success) {
        toast.success(status === 'verified' ? '✅ Document verified!' : 'Document rejected');
        setNgos(prev => prev.map(n => {
          if (n._id !== ngoId) return n;
          const docs = n.documents.map(d => d._id === docId ? { ...d, status, adminNote } : d);
          return {
            ...n,
            documents: docs,
            pendingCount:  docs.filter(d => d.status === 'pending').length,
            verifiedCount: docs.filter(d => d.status === 'verified').length,
          };
        }));
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleUploaded = (ngoId) => {
    // Refresh: collapse upload panel and reload
    setUpl(u => ({ ...u, [ngoId]: false }));
    window.location.reload();
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">Admin</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">NGO Documents</h1>
        <p className="text-gray-500 text-sm">
          Review and verify certificates uploaded by NGO representatives.
          {totalPending > 0 && (
            <span className="ml-2 bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {totalPending} pending review
            </span>
          )}
        </p>
      </div>

      {ngos.length === 0 && (
        <div className="border border-dashed border-gray-200 rounded-2xl py-20 text-center bg-white">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No NGOs have uploaded documents yet.</p>
        </div>
      )}

      <div className="space-y-4">
        {ngos.map(ngo => {
          const initials = ngo.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
          return (
            <div key={ngo._id} className="border border-gray-100 rounded-2xl bg-white shadow-sm overflow-hidden">

              {/* NGO Card Header */}
              <div className="px-6 py-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0d3b26] to-[#2e7d52] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {initials}
                  </div>

                  {/* NGO Info */}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-base leading-tight truncate">{ngo.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      {ngo.ngoId && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Hash className="w-3 h-3" /> {ngo.ngoId}
                        </span>
                      )}
                      {ngo.username && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <User className="w-3 h-3" /> {ngo.username}
                        </span>
                      )}
                      {ngo.mobile && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {ngo.mobile}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: badges + actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {ngo.pendingCount > 0 && (
                    <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {ngo.pendingCount} pending
                    </span>
                  )}
                  <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {ngo.verifiedCount} verified
                  </span>
                  <button
                    onClick={() => toggleUpload(ngo._id)}
                    className="p-1.5 rounded-lg hover:bg-emerald-50 transition-colors text-[#0d3b26]"
                    title="Upload certificate"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggle(ngo._id)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 flex items-center gap-1 text-xs font-medium"
                  >
                    {ngo.documents.length} doc{ngo.documents.length !== 1 ? 's' : ''}
                    {expanded[ngo._id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Admin Upload Panel */}
              {uploading[ngo._id] && (
                <div className="px-6 pb-4">
                  <AdminUploadPanel ngo={ngo} onUploaded={() => handleUploaded(ngo._id)} />
                </div>
              )}

              {/* Documents */}
              {expanded[ngo._id] && (
                <div className="border-t border-gray-100">
                  {ngo.documents.length === 0 && (
                    <p className="px-6 py-5 text-sm text-gray-400 italic">No documents uploaded for this NGO yet.</p>
                  )}

                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ngo.documents.map(doc => {
                      const cfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
                      const StatusIcon = cfg.icon;
                      const typeColor = DOC_TYPE_COLORS[doc.docType] || DOC_TYPE_COLORS.other;
                      return (
                        <div key={doc._id} className={`border rounded-xl p-4 ${doc.status === 'pending' ? 'border-amber-200 bg-amber-50/30' : doc.status === 'verified' ? 'border-emerald-100 bg-white' : 'border-red-100 bg-red-50/20'}`}>
                          {/* Doc header */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-start gap-2.5">
                              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${typeColor}`}>
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 text-sm leading-tight">{doc.label}</p>
                                <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md border mt-0.5 ${typeColor}`}>
                                  {CERT_TYPES.find(c => c.key === doc.docType)?.label || doc.docType}
                                </span>
                              </div>
                            </div>
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                              title="View document"
                            >
                              <ExternalLink className="w-4 h-4 text-gray-400" />
                            </a>
                          </div>

                          {/* Status + date */}
                          <div className="flex items-center justify-between">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {cfg.label}
                            </span>
                            {doc.uploadedAt && (
                              <span className="text-[10px] text-gray-300">
                                {new Date(doc.uploadedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          {/* Admin note */}
                          {doc.adminNote && doc.adminNote !== 'Uploaded by admin' && (
                            <p className="text-xs text-red-500 italic mt-2 border-t border-red-100 pt-2">{doc.adminNote}</p>
                          )}

                          {/* Review controls for pending */}
                          {doc.status === 'pending' && (
                            <div className="mt-3 pt-3 border-t border-amber-100 flex flex-col gap-2">
                              <input
                                type="text"
                                placeholder="Admin note (optional)"
                                value={note[doc._id] || ''}
                                onChange={e => setNote(n => ({ ...n, [doc._id]: e.target.value }))}
                                className="w-full h-8 text-xs border border-gray-200 rounded-lg px-3 focus:outline-none focus:border-[#0d3b26]"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleReview(ngo._id, doc._id, 'verified')}
                                  disabled={isPending}
                                  className="flex-1 h-8 bg-[#0d3b26] hover:bg-[#1a5c3a] text-white text-xs"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Verify
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleReview(ngo._id, doc._id, 'rejected')}
                                  disabled={isPending}
                                  className="flex-1 h-8 text-xs"
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
