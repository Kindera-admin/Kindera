'use client';

import { useId } from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDialogA11y } from '@/hooks/useDialogA11y';

async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error(`Could not copy the ${what.toLowerCase()}. Select it and copy by hand.`);
  }
}

// Shows a freshly generated NGO login. Only the Done button and Escape close it,
// so the password is not lost by a stray tap outside.
export default function CredentialsDialog({ credentials, onClose }) {
  const titleId = useId();
  const noteId = useId();
  const panelRef = useDialogA11y(!!credentials, onClose);

  if (!credentials) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={noteId}
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl outline-none"
      >
        <h3 id={titleId} className="text-lg font-bold text-gray-900">Login for {credentials.name}</h3>
        <p id={noteId} className="mt-1 text-sm text-gray-600">Copy these now — the password is shown once.</p>

        <div className="mt-4 space-y-4">
          {[
            { key: 'username', label: 'Username', value: credentials.username },
            { key: 'password', label: 'Password', value: credentials.password },
          ].map((field) => (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={`cred-${field.key}`}>{field.label}</Label>
              <div className="flex gap-2">
                <Input id={`cred-${field.key}`} readOnly value={field.value} className="h-11 font-mono" onFocus={(e) => e.target.select()} />
                <Button type="button" variant="outline" className="hit-target h-11" onClick={() => copy(field.value, field.label)} aria-label={`Copy ${field.label.toLowerCase()}`}>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copy
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" className="hit-target h-11" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
