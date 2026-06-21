'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, User, Clock, Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { updateUserStatus } from '@/app/actions';

export default function RegistrationsClient({ initialUsers }) {
  const [users, setUsers] = useState(initialUsers);
  const [loadingId, setLoadingId] = useState(null);

  const handleStatusUpdate = async (userId, status) => {
    setLoadingId(userId);
    try {
      // Create a FormData object as expected by updateUserStatus
      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('status', status);

      const result = await updateUserStatus(formData);
      if (result.success) {
        toast.success(`User ${status === 'approved' ? 'approved' : 'rejected'}`);
        setUsers(users.filter(u => u._id !== userId)); // Remove from pending list
      } else {
        toast.error(result.message || 'Failed to update user');
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setLoadingId(null);
    }
  };

  if (users.length === 0) {
    return (
      <div className="text-center py-20 border border-dashed border-gray-200 rounded-2xl bg-white">
        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">No Pending Registrations</h2>
        <p className="text-gray-500">You don&apos;t have any pending event registrations to review right now.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Event Registrations</h1>
        <p className="text-gray-500">Review and approve volunteers who registered for your events.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users.map(user => (
          <div key={user._id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200">
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">{user.name}</h3>
                  <p className="text-xs text-gray-500">@{user.username} • {user.age ? `${user.age} yrs` : 'Age not provided'}</p>
                </div>
              </div>
              <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-1 rounded-md flex items-center gap-1">
                <Clock className="w-3 h-3" /> Pending
              </span>
            </div>

            <div className="space-y-3 mb-5">
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                <p className="text-xs font-semibold text-emerald-800 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Event Registered For
                </p>
                <p className="text-sm font-medium text-emerald-900">
                  {user.registeredForEvent?.title || 'Unknown Event'}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-1">Contact</p>
                <p className="text-sm font-medium text-gray-800">{user.mobile} {user.email ? `• ${user.email}` : ''}</p>
              </div>

              {user.registrationReason && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <p className="text-xs font-semibold text-blue-800 mb-1">Reason / Comment</p>
                  <p className="text-sm text-blue-900 italic">&quot;{user.registrationReason}&quot;</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button 
                className="flex-1 bg-[#0d3b26] hover:bg-[#1a5c3a]" 
                onClick={() => handleStatusUpdate(user._id, 'approved')}
                disabled={loadingId === user._id}
              >
                {loadingId === user._id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Approve
              </Button>
              <Button 
                variant="destructive" 
                className="flex-1"
                onClick={() => handleStatusUpdate(user._id, 'rejected')}
                disabled={loadingId === user._id}
              >
                {loadingId === user._id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
