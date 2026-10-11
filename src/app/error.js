'use client';

import { useEffect } from 'react';
import { LifeBuoy } from 'lucide-react';
import StatusPage from '@/components/StatusPage';

// Shown when a page under the root layout throws. Never render error.message:
// it can expose internals. The digest matches the server log entry in Vercel.
export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      icon={LifeBuoy}
      title="Something went wrong on our side."
      message="Your data is safe. Try again, and if it keeps happening, message the Kindera team."
      actions={[
        { label: 'Try again', onClick: () => reset() },
        { label: 'Go to home', href: '/' },
      ]}
      code={error?.digest ? `Reference: ${error.digest}` : undefined}
    />
  );
}
