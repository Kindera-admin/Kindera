'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Plus, X, Building2, Edit2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createNGOPartner, updateNGOPartner, deleteNGOPartner } from '@/app/actions';
import ConfirmModal from '@/components/ConfirmModal';

export default function NGOPartnersClient({ initialPartners }) {
  const [partners, setPartners] = useState(initialPartners);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', focusAreas: '', programs: '', impact: '', registeredOffice: '', location: '', website: '' });

  const [photoFile, setPhotoFile] = useState(null);

  const filteredPartners = partners.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

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
    setEditingId(partner._id);
    setPhotoFile(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setForm({ name: '', description: '', focusAreas: '', programs: '', impact: '', registeredOffice: '', location: '', website: '' });
    setPhotoFile(null);
    setEditingId(null);
    setShowForm(false);
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

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Manage NGO Partners</h1>
          <p className="text-gray-500 text-sm mt-1">{partners.length} partner{partners.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => showForm ? resetForm() : setShowForm(true)} variant={showForm ? 'outline' : 'default'}>
          {showForm ? <><X className="w-4 h-4 mr-2" />Cancel</> : <><Plus className="w-4 h-4 mr-2" />Add Partner</>}
        </Button>
      </div>

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
              <Label htmlFor="location">Location <span className="text-gray-400 text-xs">(if no registered office)</span></Label>
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
          <div className="space-y-1">
            <Label htmlFor="logo">Logo / Picture <span className="text-gray-400 text-xs">(optional{editingId ? ', leave empty to keep current' : ''})</span></Label>
            <Input id="logo" type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} className="file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="programs">Programs <span className="text-gray-400 text-xs">(one per line)</span></Label>
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
            <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? (editingId ? 'Updating...' : 'Adding...') : (editingId ? 'Update Partner' : 'Add Partner')}</Button>
          </div>
        </form>
      )}

      {/* Partners List */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Search partners by name..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="pl-9"
          />
        </div>
      </div>

      {filteredPartners.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{partners.length === 0 ? 'No NGO partners yet. Add one above.' : 'No partners found matching search.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPartners.map((partner) => (
            <div key={partner._id} className="border rounded-xl p-5 bg-white flex justify-between items-start gap-4">
              {partner.logoUrl && (
                <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center">
                  <img src={partner.logoUrl} alt={`${partner.name} logo`} className="w-full h-full object-contain" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-semibold text-base">{partner.name}</h3>
                  {partner.location && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{partner.location}</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{partner.description}</p>
                {partner.focusAreas && (
                  <p className="text-xs text-gray-500 mt-1"><span className="font-medium">Focus:</span> {partner.focusAreas}</p>
                )}
                {partner.website && (
                  <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 block truncate">
                    {partner.website}
                  </a>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-500 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => handleEditClick(partner)}
                  disabled={deletingId === partner._id}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setConfirmDeleteId(partner._id)}
                  disabled={deletingId === partner._id}
                >
                  <Trash2 className="w-4 h-4" />
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
        message="Are you sure you want to delete this NGO partner? This action cannot be undone."
        confirmText="Delete NGO"
        isLoading={!!deletingId}
      />
    </div>
  );
}
