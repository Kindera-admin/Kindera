'use client';

import { cldImage } from '@/lib/cloudinary';
import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Plus, X, Building2, Edit2, Search, FileSpreadsheet, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createNGOPartner, updateNGOPartner, deleteNGOPartner, getAllNGOPartners, generateNGOLogin } from '@/app/actions';
import ConfirmModal from '@/components/ConfirmModal';
import CompanyCheckboxList from './CompanyCheckboxList';
import CredentialsDialog from './CredentialsDialog';
import ImportPanel from './ImportPanel';

const EMPTY_FORM = { name: '', description: '', focusAreas: '', programs: '', impact: '', registeredOffice: '', location: '', website: '' };

export default function NGOPartnersClient({ initialPartners, companies = [] }) {
  const [partners, setPartners] = useState(initialPartners);
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all'); // 'all' | 'public' | a company id
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formCompanyIds, setFormCompanyIds] = useState([]);

  const [photoFile, setPhotoFile] = useState(null);

  // Every company named on a loaded card, so the filter and the edit form still
  // offer an archived company that cards keep.
  const knownCompanies = new Map(companies.map((c) => [c._id, { id: c._id, name: c.name, archived: false }]));
  for (const p of partners) {
    (p.companyIds || []).forEach((id, i) => {
      if (!knownCompanies.has(id)) knownCompanies.set(id, { id, name: p.companyNames?.[i] || 'Unknown company', archived: true });
    });
  }
  const filterOptions = [...knownCompanies.values()].sort((a, b) => a.name.localeCompare(b.name));
  const activeOptions = filterOptions.filter((c) => !c.archived);
  // The edit form lists active companies plus any archived ones already on the card being edited.
  const editingPartner = partners.find((p) => p._id === editingId);
  const formOptions = filterOptions.filter((c) => !c.archived || editingPartner?.companyIds?.includes(c.id));

  const matchesCompany = (p) => {
    if (companyFilter === 'all') return true;
    if (companyFilter === 'public') return (p.companyIds || []).length === 0;
    return (p.companyIds || []).includes(companyFilter);
  };
  const filteredPartners = partners.filter(
    (p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()) && matchesCompany(p)
  );

  const uploadPhoto = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'kindera/ngo-partners');
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to upload photo');
    }
    return (await res.json()).url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let uploadedLogoUrl = '';
      if (photoFile) {
        toast.loading('Uploading logo...', { id: 'logo-upload' });
        try {
          uploadedLogoUrl = await uploadPhoto(photoFile);
          toast.dismiss('logo-upload');
        } catch (err) {
          toast.dismiss('logo-upload');
          toast.error(err.message || 'Failed to upload logo', { description: 'Proceeding without it' });
        }
      }

      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      // Always sent: on update an absent field would leave the companies unchanged, so unticking all could never save.
      formData.append('companyIds', JSON.stringify(formCompanyIds));
      if (uploadedLogoUrl) {
        formData.append('logoUrl', uploadedLogoUrl);
      }

      let result;
      if (editingId) {
        result = await updateNGOPartner(editingId, formData);
      } else {
        result = await createNGOPartner(formData);
      }

      if (result.success) {
        if (editingId) {
          setPartners((prev) => prev.map(p => p._id === editingId ? result.partner : p));
          toast.success('NGO partner updated');
        } else {
          setPartners((prev) => [result.partner, ...prev]);
          toast.success('NGO partner added');
        }
        resetForm();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error(editingId ? 'Failed to update NGO partner' : 'Failed to add NGO partner');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (partner) => {
    setForm({
      name: partner.name || '',
      description: partner.description || '',
      focusAreas: partner.focusAreas || '',
      programs: partner.programs?.join('\n') || '',
      impact: partner.impact || '',
      registeredOffice: partner.registeredOffice || '',
      location: partner.location || '',
      website: partner.website || ''
    });
    setFormCompanyIds(partner.companyIds || []);
    setEditingId(partner._id);
    setPhotoFile(null);
    setShowImport(false);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFormCompanyIds([]);
    setPhotoFile(null);
    setEditingId(null);
    setShowForm(false);
  };

  const toggleForm = () => {
    if (showForm) {
      resetForm();
    } else {
      setShowImport(false);
      setShowForm(true);
    }
  };

  const toggleImport = () => {
    if (!showImport) resetForm();
    setShowImport((open) => !open);
  };

  const reloadPartners = async () => {
    const res = await getAllNGOPartners();
    if (res.success) setPartners(res.partners);
    else toast.error(res.message);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return;
    setDeletingId(confirmDeleteId);
    try {
      const result = await deleteNGOPartner(confirmDeleteId);
      if (result.success) {
        setPartners((prev) => prev.filter((p) => p._id !== confirmDeleteId));
        toast.success('NGO partner removed');
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Failed to delete NGO partner');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleGenerateLogin = async (partner) => {
    setGeneratingId(partner._id);
    try {
      const result = await generateNGOLogin(partner._id);
      if (result.success) {
        setPartners((prev) => prev.map((p) => (p._id === partner._id ? { ...p, loginUsername: result.username } : p)));
        setCredentials({ name: partner.name, username: result.username, password: result.password });
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Could not generate a login. Please try again.');
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Manage NGO Partners</h1>
          <p className="text-gray-500 text-sm mt-1">{partners.length} partner{partners.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={toggleImport} variant={showImport ? 'secondary' : 'outline'} className="hit-target h-11" aria-expanded={showImport}>
            <FileSpreadsheet className="w-4 h-4 mr-2" aria-hidden="true" />Import from Excel
          </Button>
          <Button onClick={toggleForm} variant={showForm ? 'outline' : 'default'} className="hit-target h-11">
            {showForm ? <><X className="w-4 h-4 mr-2" aria-hidden="true" />Cancel</> : <><Plus className="w-4 h-4 mr-2" aria-hidden="true" />Add Partner</>}
          </Button>
        </div>
      </div>

      {showImport && (
        <ImportPanel companyOptions={activeOptions} onImported={reloadPartners} onClose={() => setShowImport(false)} />
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-xl p-5 mb-6 bg-gray-50 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-600">{editingId ? 'Edit NGO Partner' : 'New NGO Partner'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" placeholder="NGO name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="registeredOffice">Registered Office</Label>
              <Input id="registeredOffice" placeholder="City" value={form.registeredOffice} onChange={(e) => setForm((f) => ({ ...f, registeredOffice: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="location">Location <span className="text-gray-500 text-xs">(if no registered office)</span></Label>
              <Input id="location" placeholder="City / Pan India / Various Locations" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="website">Website</Label>
              <Input id="website" placeholder="https://..." value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description *</Label>
            <textarea
              id="description"
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-y bg-white"
              placeholder="Brief description of the NGO"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="focusAreas">Focus Areas</Label>
            <Input id="focusAreas" placeholder="Education, Healthcare, Environment..." value={form.focusAreas} onChange={(e) => setForm((f) => ({ ...f, focusAreas: e.target.value }))} />
          </div>
          <CompanyCheckboxList
            legend="Companies"
            hint="Only these companies see this NGO. Leave all unticked to keep it a public partner."
            options={formOptions}
            selected={formCompanyIds}
            onChange={setFormCompanyIds}
          />
          <div className="space-y-1">
            <Label htmlFor="logo">Logo / Picture <span className="text-gray-500 text-xs">(optional{editingId ? ', leave empty to keep current' : ''})</span></Label>
            <Input id="logo" type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} className="file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="programs">Programs <span className="text-gray-500 text-xs">(one per line)</span></Label>
            <textarea
              id="programs"
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-y bg-white"
              placeholder="Program 1&#10;Program 2&#10;Program 3"
              value={form.programs}
              onChange={(e) => setForm((f) => ({ ...f, programs: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="impact">Impact</Label>
            <textarea
              id="impact"
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[60px] resize-y bg-white"
              placeholder="Impact statement (shown in green box)"
              value={form.impact}
              onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" className="hit-target h-11" onClick={resetForm}>Cancel</Button>
            <Button type="submit" className="hit-target h-11" disabled={isSubmitting}>{isSubmitting ? (editingId ? 'Updating...' : 'Adding...') : (editingId ? 'Update Partner' : 'Add Partner')}</Button>
          </div>
        </form>
      )}

      {/* Partners List */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end mb-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
          <Input
            aria-label="Search partners by name"
            placeholder="Search partners by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-11"
          />
        </div>
        <div className="space-y-1 w-full sm:w-64">
          <Label htmlFor="company-filter" className="sr-only">Filter by company</Label>
          <select
            id="company-filter"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="h-11 w-full rounded-md border border-input bg-white px-3 text-base md:text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          >
            <option value="all">All partners</option>
            <option value="public">Public partners</option>
            {filterOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.archived ? ' (archived)' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredPartners.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
          <p className="text-sm">{partners.length === 0 ? 'No NGO partners yet. Add one above.' : 'No partners match your search and filter.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPartners.map((partner) => (
            <div key={partner._id} className="border rounded-xl p-5 bg-white flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div className="flex flex-1 min-w-0 items-start gap-4">
                {partner.logoUrl && (
                  <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center">
                    <img src={cldImage(partner.logoUrl, 160)} loading="lazy" decoding="async" alt={`${partner.name} logo`} className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base break-words">{partner.name}</h3>
                    {partner.location && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{partner.location}</span>
                    )}
                  </div>
                  <ul className="flex flex-wrap gap-1.5 mt-1.5" aria-label="Companies">
                    {(partner.companyIds || []).length === 0 ? (
                      <li className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Public partner</li>
                    ) : (
                      partner.companyNames.map((name, i) => (
                        <li key={partner.companyIds[i]} className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{name}</li>
                      ))
                    )}
                  </ul>
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{partner.description}</p>
                  {partner.focusAreas && (
                    <p className="text-xs text-gray-500 mt-1"><span className="font-medium">Focus:</span> {partner.focusAreas}</p>
                  )}
                  {partner.website && (
                    <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 block truncate">
                      {partner.website}
                    </a>
                  )}
                  <div className="mt-3">
                    {partner.loginUsername ? (
                      <p className="inline-flex items-center gap-1.5 text-xs text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">
                        <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                        Login: <span className="font-mono break-all">{partner.loginUsername}</span>
                      </p>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="hit-target h-9"
                        onClick={() => handleGenerateLogin(partner)}
                        disabled={generatingId === partner._id || deletingId === partner._id}
                      >
                        {generatingId === partner._id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <KeyRound className="w-4 h-4" aria-hidden="true" />}
                        Generate login
                        <span className="sr-only"> for {partner.name}</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="hit-target text-gray-500 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => handleEditClick(partner)}
                  aria-label={`Edit ${partner.name}`}
                  disabled={deletingId === partner._id}
                >
                  <Edit2 className="w-4 h-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hit-target text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setConfirmDeleteId(partner._id)}
                  aria-label={`Delete ${partner.name}`}
                  disabled={deletingId === partner._id}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        onClose={() => !deletingId && setConfirmDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete NGO Partner"
        message="Are you sure you want to delete this NGO partner? Its NGO login will stop working. This action cannot be undone."
        confirmText="Delete NGO"
        confirmPhrase={partners.find((p) => p._id === confirmDeleteId)?.name || ''}
        isLoading={!!deletingId}
      />

      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
}
