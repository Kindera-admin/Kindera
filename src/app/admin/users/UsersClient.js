'use client';

import { useState, Fragment } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { deleteUser, updateUserStatus } from '@/app/actions';
import { useRouter } from 'next/navigation';

function CertRow({ label, has, reg, color }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      {has ? (
        <div className="text-right">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 ${color}`}>Yes</span>
          {reg && <p className="text-xs text-gray-500 mt-0.5">{reg}</p>}
        </div>
      ) : (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">No</span>
      )}
    </div>
  );
}

function UserModal({ user, onClose, onStatusUpdate, isUpdatingStatus }) {
  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Approved</span>;
      case 'rejected': return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Rejected</span>;
      default: return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Pending</span>;
    }
  };

  const getRoleDisplay = (role) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'ngo': return 'NGO';
      case 'org_spoc': return 'Organisation SPOC';
      case 'org_member': return 'Organisation Member';
      default: return role;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold">{user.name}</h2>
            <p className="text-sm text-gray-500">@{user.username}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Role</p>
              <p className="font-medium">{getRoleDisplay(user.role)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Status</p>
              {getStatusBadge(user.status)}
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Organisation</p>
              <p className="font-medium">{user.organizationName || user.ngoId || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Mobile</p>
              <p className="font-medium">{user.mobile || '—'}</p>
            </div>
          </div>

          {/* Certifications */}
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Certifications</p>
            <div className="rounded-lg border px-3">
              <CertRow label="12A" has={user.has12A} reg={user.reg12A} color="text-green-700" />
              <CertRow label="80G" has={user.has80G} reg={user.reg80G} color="text-blue-700" />
              <CertRow label="FCRA" has={user.hasFCRA} reg={user.regFCRA} color="text-purple-700" />
            </div>
          </div>
        </div>

        {/* Footer — approve/reject actions */}
        {(user.status === 'pending' || user.status === 'rejected') && (
          <div className="px-6 py-4 border-t flex gap-3">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => onStatusUpdate(user._id, 'approved')}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? 'Saving...' : 'Approve'}
            </Button>
            {user.status === 'pending' && (
              <Button
                variant="outline"
                className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                onClick={() => onStatusUpdate(user._id, 'rejected')}
                disabled={isUpdatingStatus}
              >
                Reject
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function UsersClient({ initialUsers = [], currentUserId }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState(initialUsers);
  const [isDeleting, setIsDeleting] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.name.toLowerCase().includes(searchLower) ||
      user.username.toLowerCase().includes(searchLower) ||
      (user.ngoId && user.ngoId.toLowerCase().includes(searchLower)) ||
      (user.organizationName && user.organizationName.toLowerCase().includes(searchLower))
    );
  });

  const handleConfirmDelete = (userId) => setShowConfirmation(userId);
  const handleCancelDelete = () => setShowConfirmation(null);

  const handleDelete = async (userId) => {
    if (userId === currentUserId) {
      toast.error('Cannot delete your own account');
      return;
    }
    setIsDeleting(userId);
    try {
      const formData = new FormData();
      formData.append('userId', userId);
      const result = await deleteUser(formData);
      if (result.success) {
        setUsers(prev => prev.filter(u => u._id !== userId));
        toast.success('User deleted', { description: 'User and all associated data have been removed' });
      } else {
        toast.error('Failed to delete user', { description: result.message || 'An error occurred' });
      }
    } catch {
      toast.error('Failed to delete user', { description: 'An unexpected error occurred' });
    } finally {
      setIsDeleting(null);
      setShowConfirmation(null);
    }
  };

  const handleStatusUpdate = async (userId, status) => {
    setIsUpdatingStatus(userId);
    try {
      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('status', status);
      const result = await updateUserStatus(formData);
      if (result.success) {
        if (result.modifiedCount === 0) {
          toast.error('Update had no effect', { description: 'Status may already be set or user not found in DB.' });
        } else {
          setUsers(prev => prev.map(u => u._id === userId ? { ...u, status } : u));
          // Keep modal in sync
          setSelectedUser(prev => prev?._id === userId ? { ...prev, status } : prev);
          toast.success(status === 'approved' ? 'User approved' : 'User rejected');
        }
      } else {
        toast.error('Failed to update status', { description: result.message });
      }
    } catch {
      toast.error('Failed to update status', { description: 'An unexpected error occurred' });
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const getRoleDisplay = (role) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'ngo': return 'NGO';
      case 'org_spoc': return 'Organisation SPOC';
      case 'org_member': return 'Organisation Member';
      default: return role;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'text-purple-600 font-semibold';
      case 'ngo': return 'text-blue-600';
      case 'org_spoc': return 'text-green-600 font-semibold';
      case 'org_member': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Approved</span>;
      case 'rejected': return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Rejected</span>;
      default: return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Pending</span>;
    }
  };

  const pendingCount = users.filter(u => u.status === 'pending').length;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Modal */}
      {selectedUser && (
        <UserModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onStatusUpdate={handleStatusUpdate}
          isUpdatingStatus={isUpdatingStatus === selectedUser._id}
        />
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Manage Users</h1>
          {pendingCount > 0 && (
            <p className="text-sm text-yellow-600 mt-1">{pendingCount} user{pendingCount > 1 ? 's' : ''} pending approval</p>
          )}
        </div>
        <Button onClick={() => router.push('/admin/register')}>Register New User</Button>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle>User Management</CardTitle>
          <CardDescription>Click a row to view details & certifications. View, approve, and manage all registered users.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search by name, username, NGO ID, or organisation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>

          {users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No users found.</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No users match your search.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>NGO ID / Organisation</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Certs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <Fragment key={user._id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedUser(user)}
                      >
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>
                          <span className={getRoleColor(user.role)}>{getRoleDisplay(user.role)}</span>
                        </TableCell>
                        <TableCell>{user.ngoId || user.organizationName || '-'}</TableCell>
                        <TableCell>{user.mobile || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {user.has12A && <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 font-medium">12A</span>}
                            {user.has80G && <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-medium">80G</span>}
                            {user.hasFCRA && <span className="px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700 font-medium">FCRA</span>}
                            {!user.has12A && !user.has80G && !user.hasFCRA && <span className="text-gray-400 text-xs">—</span>}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(user.status)}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2 flex-wrap">
                            {user.status === 'pending' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-green-600 border-green-300 hover:bg-green-50"
                                  onClick={() => handleStatusUpdate(user._id, 'approved')}
                                  disabled={isUpdatingStatus === user._id}
                                >
                                  {isUpdatingStatus === user._id ? '...' : 'Approve'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 border-red-300 hover:bg-red-50"
                                  onClick={() => handleStatusUpdate(user._id, 'rejected')}
                                  disabled={isUpdatingStatus === user._id}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {user.status === 'rejected' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => handleStatusUpdate(user._id, 'approved')}
                                disabled={isUpdatingStatus === user._id}
                              >
                                Approve
                              </Button>
                            )}
                            {showConfirmation === user._id ? (
                              <>
                                <Button variant="outline" size="sm" onClick={handleCancelDelete}>Cancel</Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDelete(user._id)}
                                  disabled={isDeleting === user._id}
                                >
                                  {isDeleting === user._id ? 'Deleting...' : 'Confirm'}
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleConfirmDelete(user._id)}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mt-8">
        <h3 className="text-amber-800 font-semibold mb-2">Warning</h3>
        <p className="text-amber-800">
          Deleting a user will also remove all their associated data, including reports. This action cannot be undone.
        </p>
      </div>
    </div>
  );
}
