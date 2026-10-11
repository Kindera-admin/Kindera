'use client';

import { useEffect } from 'react';
import { LifeBuoy } from 'lucide-react';
import StatusPage from '@/components/StatusPage';
import './globals.css';

// Replaces the root layout when the layout itself fails, so it renders its
// own <html> and <body>.
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-paper font-sans text-gray-900">
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
      </body>
    </html>
  );
}
