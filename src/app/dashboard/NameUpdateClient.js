'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { updateMemberName } from '@/app/actions';

export default function NameUpdateClient({ currentName }) {
  const router = useRouter();
  const [name, setName] = useState(currentName || '');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      toast.error('Please enter a valid name.');
      return;
    }

    startTransition(async () => {
      const result = await updateMemberName(name);
      if (result.success) {
        toast.success('Name updated successfully!');
        // The server action revalidates the path, so Next.js will reload the dashboard
        // We can also force a refresh if needed, but revalidatePath usually handles it.
      } else {
        toast.error(result.message || 'Failed to update name.');
      }
    });
  };

  return (
    <div className="w-full max-w-md mx-auto mt-10">
      <div className="border border-gray-100 rounded-2xl p-8 bg-white shadow-sm text-center">
        <div className="w-16 h-16 bg-[#f0f7f3] text-[#2e7d52] rounded-full flex items-center justify-center mx-auto mb-6">
          <UserCircle className="w-8 h-8" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Kindera!</h1>
        <p className="text-gray-500 text-sm mb-8">
          Your organization has generated an account for you. Please enter your real name to continue.
        </p>

        <form onSubmit={handleSubmit} className="text-left space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane Doe"
              disabled={isPending}
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full bg-[#0d3b26] hover:bg-[#1a5c3a] text-white" 
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save & Continue'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
