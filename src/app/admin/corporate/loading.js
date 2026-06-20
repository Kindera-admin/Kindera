import { SkeletonTable } from '@/components/SkeletonPulse';

export default function CorporateLoading() {
  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="h-8 w-56 bg-gray-200 animate-pulse rounded mb-2" />
      <div className="h-4 w-80 bg-gray-100 animate-pulse rounded mb-8" />
      <SkeletonTable rows={6} cols={6} />
    </div>
  );
}
