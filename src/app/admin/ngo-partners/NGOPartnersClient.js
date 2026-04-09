'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Plus, X, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createNGOPartner, deleteNGOPartner } from '@/app/actions';

export default function NGOPartnersClient({ initialPartners }) {
  const [partners, setPartners] = useState(initialPartners);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', focusAreas: '', programs: '', impact: '', registeredOffice: '', location: '', website: '' });

  const handleAdd = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      const result = await createNGOPartner(formData);
      if (result.success) {
        setPartners((prev) => [result.partner, ...prev]);
        setForm({ name: '', description: '', focusAreas: '', programs: '', impact: '', registeredOffice: '', location: '', website: '' });
        setShowForm(false);
        toast.success('NGO partner added');
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Failed to add NGO partner');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this NGO partner? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const result = await deleteNGOPartner(id);
      if (result.success) {
        setPartners((prev) => prev.filter((p) => p._id !== id));
        toast.success('NGO partner removed');
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Failed to delete NGO partner');
    } finally {
      setDeletingId(null);
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
        <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? 'outline' : 'default'}>
          {showForm ? <><X className="w-4 h-4 mr-2" />Cancel</> : <><Plus className="w-4 h-4 mr-2" />Add Partner</>}
        </Button>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleAdd} className="border rounded-xl p-5 mb-6 bg-gray-50 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-600">New NGO Partner</h2>
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
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add Partner'}</Button>
          </div>
        </form>
      )}

      {/* Partners List */}
      {partners.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No NGO partners yet. Add one above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {partners.map((partner) => (
            <div key={partner._id} className="border rounded-xl p-5 bg-white flex justify-between items-start gap-4">
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
              <Button
                variant="ghost"
                size="icon"
                className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                onClick={() => handleDelete(partner._id)}
                disabled={deletingId === partner._id}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
