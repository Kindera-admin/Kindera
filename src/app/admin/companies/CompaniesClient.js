'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, Building2, Check, ImageUp, Loader2, Pencil, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cldImage } from '@/lib/cloudinary';
import {
  createCompany, renameCompany, archiveCompany, restoreCompany, updateCompanyLogo,
} from '@/app/companyActions';

export default function CompaniesClient({ companies }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const fileRef = useRef(null);
  const logoTarget = useRef(null);

  const visible = companies.filter((c) => showArchived || c.status === 'active');

  const act = (fn, successMessage, after) => startTransition(async () => {
    const res = await fn();
    if (res.success) {
      toast.success(successMessage);
      after?.();
      router.refresh();
    } else {
      toast.error(res.message);
    }
  });

  const handleCreate = (e) => {
    e.preventDefault();
    act(() => createCompany(newName), `${newName.trim()} added`, () => setNewName(''));
  };

  const handleRename = (id) => act(() => renameCompany(id, editName), 'Company renamed', () => setEditingId(null));

  const pickLogo = (id) => {
    logoTarget.current = id;
    fileRef.current?.click();
  };

  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const id = logoTarget.current;
    if (!file || !id) return;
    setUploadingId(id);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'kindera/organization-logos');
      const upload = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await upload.json();
      if (!upload.ok) throw new Error(data.error || 'Upload failed');
      const res = await updateCompanyLogo(data.url, id);
      if (!res.success) throw new Error(res.message);
      toast.success('Logo updated');
      router.refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
          <p className="mt-1 text-sm text-gray-600">Corporate clients. SPOCs and employees are attached to one of these.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
          Show archived
        </label>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row">
        <label htmlFor="new-company" className="sr-only">New company name</label>
        <Input id="new-company" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New company name, e.g. Tata Consultancy Services" className="flex-1" />
        <Button type="submit" disabled={isPending || newName.trim().length < 2}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          Add company
        </Button>
      </form>

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoFile} />

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-6 py-3">Company</th>
              <th className="px-6 py-3 text-right">SPOCs</th>
              <th className="px-6 py-3 text-right">Employees</th>
              <th className="px-6 py-3 text-right">Hours</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-gray-500">
                  <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-300" aria-hidden="true" />
                  No companies yet. Add your first corporate client above.
                </td>
              </tr>
            )}
            {visible.map((c) => (
              <tr key={c._id} className={`border-t border-gray-50 ${c.status === 'archived' ? 'opacity-60' : ''}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {c.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cldImage(c.logoUrl, 80)} alt="" className="h-9 w-9 rounded-lg object-contain" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white" aria-hidden="true">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {editingId === c._id ? (
                      <form onSubmit={(e) => { e.preventDefault(); handleRename(c._id); }} className="flex items-center gap-1">
                        <label htmlFor={`rename-${c._id}`} className="sr-only">Company name</label>
                        <Input id={`rename-${c._id}`} value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9 w-56" autoFocus />
                        <Button type="submit" size="icon" aria-label="Save name" disabled={isPending}><Check className="h-4 w-4" aria-hidden="true" /></Button>
                        <Button type="button" size="icon" variant="outline" aria-label="Cancel rename" onClick={() => setEditingId(null)}><X className="h-4 w-4" aria-hidden="true" /></Button>
                      </form>
                    ) : (
                      <div>
                        <p className="font-medium text-gray-900">{c.name}</p>
                        {c.status === 'archived' && <p className="text-xs text-gray-500">Archived</p>}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right tabular-nums">{c.spocCount}</td>
                <td className="px-6 py-4 text-right tabular-nums">{c.memberCount}</td>
                <td className="px-6 py-4 text-right font-semibold text-brand tabular-nums">{c.volunteerHours.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="icon" aria-label={`Rename ${c.name}`} onClick={() => { setEditingId(c._id); setEditName(c.name); }}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button variant="outline" size="icon" aria-label={`Upload logo for ${c.name}`} onClick={() => pickLogo(c._id)} disabled={uploadingId === c._id}>
                      {uploadingId === c._id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImageUp className="h-4 w-4" aria-hidden="true" />}
                    </Button>
                    {c.status === 'active' ? (
                      <Button variant="outline" size="icon" aria-label={`Archive ${c.name}`} disabled={isPending} onClick={() => act(() => archiveCompany(c._id), `${c.name} archived`)}>
                        <Archive className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    ) : (
                      <Button variant="outline" size="icon" aria-label={`Restore ${c.name}`} disabled={isPending} onClick={() => act(() => restoreCompany(c._id), `${c.name} restored`)}>
                        <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
