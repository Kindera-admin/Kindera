'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function HomeButtons({ route, label, external = false }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (external) {
      window.open(route, '_blank');
    } else {
      startTransition(() => {
        router.push(route);
      });
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      className="w-full sm:w-auto gap-2"
    >
      {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
      {isPending ? 'Loading…' : label}
    </Button>
  );
}