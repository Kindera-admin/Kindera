import { SkeletonCard } from '@/components/SkeletonPulse';

export default function DocumentsLoading() {
  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="h-8 w-48 bg-gray-200 animate-pulse rounded mb-2" />
      <div className="h-4 w-64 bg-gray-100 animate-pulse rounded mb-8" />
      {[1, 2, 3].map(i => <SkeletonCard key={i} lines={2} className="mb-3" />)}
    </div>
  );
}
