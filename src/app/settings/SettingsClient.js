'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { updateProfileName } from '@/app/actions';

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
      </div>
    </div>
  );
}
