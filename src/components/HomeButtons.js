'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function HomeButtons({ route, label, external = false }) {
  const router = useRouter();
  
  const handleClick = () => {
    if (external) {
      window.open(route, '_blank');
    } else {
      router.push(route);
    }
  };
  
  return (
    <Button onClick={handleClick} className="w-full sm:w-auto">
      {label}
    </Button>
  );
}