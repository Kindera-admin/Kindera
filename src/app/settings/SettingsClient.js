'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { User, Loader2, Building2, ImagePlus, X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { updateProfileName, updateOrganizationLogo, updatePassword } from '@/app/actions';

export default function SettingsClient({ user }) {
  const router = useRouter();
  
  // Nickname State
  const [name, setName] = useState(user.name || '');
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  const handleUpdateName = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsUpdatingName(true);
    const res = await updateProfileName(name);
    setIsUpdatingName(false);

    if (res.success) {
      toast.success('Nickname updated successfully!');
      router.refresh();
    } else {
      toast.error(res.message || 'Failed to update nickname');
    }
  };

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;

    setIsUpdatingPassword(true);
    const res = await updatePassword(currentPassword, newPassword);
    setIsUpdatingPassword(false);

    if (res.success) {
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
    } else {
      toast.error(res.message || 'Failed to update password');
    }
  };

  const [logo, setLogo] = useState(user.organizationLogo || '');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setIsUploadingLogo(true);
    const toastId = toast.loading('Uploading logo...');

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'kindera/organization-logos');

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: fd
      });

      if (!uploadRes.ok) throw new Error('Upload failed');
      const { url } = await uploadRes.json();

      const saveRes = await updateOrganizationLogo(url);
      if (saveRes.success) {
        setLogo(url);
        toast.success('Organization logo updated!', { id: toastId });
        router.refresh();
      } else {
        throw new Error(saveRes.message);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to upload logo', { id: toastId });
    } finally {
      setIsUploadingLogo(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleRemoveLogo = async () => {
    setIsUploadingLogo(true);
    const toastId = toast.loading('Removing logo...');
    try {
      const saveRes = await updateOrganizationLogo('');
      if (saveRes.success) {
        setLogo('');
        toast.success('Organization logo removed!', { id: toastId });
        router.refresh();
      } else {
        throw new Error(saveRes.message);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to remove logo', { id: toastId });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-500">Manage your profile and security preferences.</p>
      </div>

      <div className="max-w-2xl">
        {/* Profile Settings */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5 text-[#2e7d52]" /> Profile
            </CardTitle>
            <CardDescription>Update your display name.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateName} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nickname">Nickname / Full Name</Label>
                <Input
                  id="nickname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              <Button type="submit" disabled={isUpdatingName} className="w-full bg-[#0d3b26] hover:bg-[#1a5c3a]">
                {isUpdatingName && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Update Name
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Password Settings */}
        <Card className="shadow-sm mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="w-5 h-5 text-gray-500" /> Security
            </CardTitle>
            <CardDescription>Update your password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" disabled={isUpdatingPassword || !currentPassword || !newPassword} className="w-full bg-gray-900 hover:bg-gray-800 text-white">
                {isUpdatingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Change Password
              </Button>
            </form>
          </CardContent>
        </Card>
        
        {/* Organization Logo Settings (SPOC only) */}
        {user.role === 'org_spoc' && (
          <Card className="shadow-sm mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5 text-[#3d5a99]" /> Corporate Branding
              </CardTitle>
              <CardDescription>Upload your organization logo to display on volunteer certificates.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {logo ? (
                  <div className="relative inline-block border rounded-lg p-2 bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo} alt="Organization Logo" className="h-24 object-contain" />
                    <button
                      onClick={handleRemoveLogo}
                      disabled={isUploadingLogo}
                      className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200 transition-colors"
                      title="Remove logo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center bg-gray-50">
                    <ImagePlus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-4">No logo uploaded yet</p>
                  </div>
                )}
                
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={isUploadingLogo}
                    className="max-w-xs cursor-pointer"
                    id="logo-upload"
                  />
                  {isUploadingLogo && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
                </div>
                <p className="text-xs text-gray-400">Recommended size: 400x150px. Max 2MB.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
