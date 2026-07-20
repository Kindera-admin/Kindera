'use client';

import { useState, useTransition } from 'react';
import { FileText, Upload, CheckCircle2, XCircle, Clock, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { uploadNGODocument, deleteNGODocument } from '@/app/actions';
import ConfirmModal from '@/components/ConfirmModal';

const STATUS_CONFIG = {
  pending:  { label: 'Pending Review', color: 'bg-amber-100 text-amber-700',  icon: Clock },
  verified: { label: 'Verified ✓',     color: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
  rejected: { label: 'Rejected',        color: 'bg-red-100 text-red-700',      icon: XCircle },
};

const DOC_TYPES = [
  { value: '12A',          label: '12A Certificate' },
  { value: '80G',          label: '80G Certificate' },
  { value: 'FCRA',         label: 'FCRA Certificate' },
  { value: 'registration', label: 'Registration Certificate' },
  { value: 'other',        label: 'Other Document' },
];

export default function DocumentsClient({ documents: initial }) {
  const [documents, setDocuments] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading]   = useState(false);
  const [form, setForm] = useState({ docType: '12A', label: '' });
  const [file, setFile] = useState(null);

  const handleUpload = async () => {
    if (!file || !form.label.trim()) {
      toast.error('Please select a file and enter a label');
      return;
    }
    setUploading(true);
    try {
      // 1. Upload file to Cloudinary
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'kindera/documents');
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
      const { url, error } = await uploadRes.json();
      if (error || !url) throw new Error(error || 'Upload failed');

      // 2. Save document metadata
      const actionFd = new FormData();
      actionFd.append('docType', form.docType);
      actionFd.append('label', form.label);
      actionFd.append('url', url);
      const res = await uploadNGODocument(actionFd);

      if (res.success) {
        toast.success('Document uploaded successfully!');
        setDocuments(prev => [...prev, {
          _id: Math.random().toString(),
          docType: form.docType,
          label: form.label,
          url,
          uploadedAt: new Date().toISOString(),
          status: 'pending',
          adminNote: '',
        }]);
        setForm({ docType: '12A', label: '' });
        setFile(null);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleDeleteConfirm = () => {
    if (!confirmDeleteId) return;
    startTransition(async () => {
      const res = await deleteNGODocument(confirmDeleteId);
      if (res.success) {
        toast.success('Document removed');
        setDocuments(prev => prev.filter(d => d._id !== confirmDeleteId));
      } else {
        toast.error(res.message);
      }
      setConfirmDeleteId(null);
    });
  };

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-[#2e7d52] mb-1">NGO Profile</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Document Vault</h1>
        <p className="text-gray-500 text-sm">
          Upload your legal certificates. Admin will review and verify them.
        </p>
      </div>

      {/* Upload Form */}
      <div className="border border-gray-100 rounded-2xl p-6 bg-white shadow-sm mb-6">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-[#2e7d52]" />
          Upload New Document
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Document Type</label>
            <select
              value={form.docType}
              onChange={e => setForm(f => ({ ...f, docType: e.target.value }))}
              className="w-full h-9 border border-gray-200 rounded-md px-3 text-sm focus:outline-none focus:border-[#0d3b26] bg-white"
            >
              {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Label</label>
            <input
              type="text"
              placeholder="e.g. 12A Certificate 2024"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              className="w-full h-9 border border-gray-200 rounded-md px-3 text-sm focus:outline-none focus:border-[#0d3b26]"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">File (PDF, JPG, PNG)</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#0d3b26] file:text-white hover:file:bg-[#1a5c3a] cursor-pointer"
          />
          {file && <p className="text-xs text-gray-400 mt-1">{file.name}</p>}
        </div>
        <Button
          onClick={handleUpload}
          disabled={uploading || !file || !form.label.trim()}
          className="bg-[#0d3b26] hover:bg-[#1a5c3a] text-white gap-2"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading…' : 'Upload Document'}
        </Button>
      </div>

      {/* Documents list */}
      <div className="space-y-3">
        {documents.length === 0 && (
          <div className="border border-dashed border-gray-200 rounded-xl py-12 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No documents uploaded yet.</p>
            <p className="text-gray-300 text-xs mt-1">Upload your 12A, 80G, or FCRA certificates above.</p>
          </div>
        )}
        {documents.map(doc => {
          const cfg = STATUS_CONFIG[doc.status];
          const Icon = cfg.icon;
          return (
            <div key={doc._id} className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{doc.label}</p>
                <p className="text-xs text-gray-400">
                  {DOC_TYPES.find(t => t.value === doc.docType)?.label || doc.docType}
                  {doc.uploadedAt && ` · ${new Date(doc.uploadedAt).toLocaleDateString()}`}
                </p>
                {doc.status === 'rejected' && doc.adminNote && (
                  <p className="text-xs text-red-500 mt-0.5 italic">{doc.adminNote}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </span>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </a>
                <button
                  onClick={() => setConfirmDeleteId(doc._id)}
                  disabled={isPending}
                  className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        onClose={() => !isPending && setConfirmDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmText="Delete Document"
        isLoading={isPending}
      />
    </div>
  );
}
