'use client';

import { useState, useTransition } from 'react';
import { FileText, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { reviewNGODocument } from '@/app/actions';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: 'bg-amber-100 text-amber-700',  icon: Clock },
  verified: { label: 'Verified', color: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700',      icon: XCircle },
};

const DOC_LABELS = {
  '12A': '12A Certificate',
  '80G': '80G Certificate',
  'FCRA': 'FCRA Certificate',
  'registration': 'Registration Certificate',
  'other': 'Other Document',
};

export default function NGODocumentsClient({ ngos: initial }) {
  const [ngos, setNgos]       = useState(initial);
  const [expanded, setExpanded] = useState({});
  const [note, setNote]       = useState({});
  const [isPending, startTransition] = useTransition();

  const totalPending = ngos.reduce((s, n) => s + n.pendingCount, 0);

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const handleReview = (ngoId, docId, status) => {
    const adminNote = note[docId] || '';
    startTransition(async () => {
      const res = await reviewNGODocument(ngoId, docId, status, adminNote);
      if (res.success) {
        toast.success(status === 'verified' ? 'Document verified!' : 'Document rejected');
        setNgos(prev => prev.map(n => {
          if (n._id !== ngoId) return n;
          return {
            ...n,
            documents: n.documents.map(d =>
              d._id === docId ? { ...d, status, adminNote } : d
            ),
            pendingCount:  n.documents.filter(d => (d._id === docId ? status : d.status) === 'pending').length,
            verifiedCount: n.documents.filter(d => (d._id === docId ? status : d.status) === 'verified').length,
          };
        }));
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">Admin</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">NGO Documents</h1>
        <p className="text-gray-500 text-sm">
          Review and verify certificates uploaded by NGO partners.
          {totalPending > 0 && (
            <span className="ml-2 bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {totalPending} pending
            </span>
          )}
        </p>
      </div>

      <div className="space-y-3">
        {ngos.length === 0 && (
          <div className="border border-gray-100 rounded-xl py-16 text-center bg-white">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No NGOs have uploaded documents yet.</p>
          </div>
        )}

        {ngos.map(ngo => (
          <div key={ngo._id} className="border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden">
            {/* NGO row */}
            <button
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/60 transition-colors"
              onClick={() => toggle(ngo._id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#0d3b26] flex items-center justify-center text-white text-sm font-bold">
                  {ngo.name.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 text-sm">{ngo.name}</p>
                  <p className="text-xs text-gray-400">{ngo.ngoId}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {ngo.pendingCount > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {ngo.pendingCount} pending
                  </span>
                )}
                <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {ngo.verifiedCount} verified
                </span>
                <span className="text-xs text-gray-400">{ngo.documents.length} doc{ngo.documents.length !== 1 ? 's' : ''}</span>
                {expanded[ngo._id] ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {/* Documents list */}
            {expanded[ngo._id] && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {ngo.documents.length === 0 && (
                  <p className="px-6 py-4 text-sm text-gray-400">No documents uploaded.</p>
                )}
                {ngo.documents.map(doc => {
                  const cfg = STATUS_CONFIG[doc.status];
                  const Icon = cfg.icon;
                  return (
                    <div key={doc._id} className="px-6 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <FileText className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm text-gray-900">{doc.label}</p>
                            <p className="text-xs text-gray-400">{DOC_LABELS[doc.docType] || doc.docType}</p>
                            {doc.uploadedAt && (
                              <p className="text-xs text-gray-300 mt-0.5">
                                Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                              </p>
                            )}
                            {doc.adminNote && (
                              <p className="text-xs text-red-500 mt-1 italic">{doc.adminNote}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                            title="View document"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                          </a>
                        </div>
                      </div>

                      {doc.status === 'pending' && (
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Admin note (optional)"
                            value={note[doc._id] || ''}
                            onChange={e => setNote(n => ({ ...n, [doc._id]: e.target.value }))}
                            className="flex-1 h-8 text-xs border border-gray-200 rounded-md px-3 focus:outline-none focus:border-[#0d3b26]"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleReview(ngo._id, doc._id, 'verified')}
                            disabled={isPending}
                            className="h-8 bg-[#0d3b26] hover:bg-[#1a5c3a] text-white text-xs"
                          >
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReview(ngo._id, doc._id, 'rejected')}
                            disabled={isPending}
                            className="h-8 text-xs"
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
