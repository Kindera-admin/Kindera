import { SkeletonTable } from '@/components/SkeletonPulse';

export default function EventsHistoryLoading() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <div className="h-8 w-56 bg-gray-200 animate-pulse rounded mb-2" />
      <div className="h-4 w-80 bg-gray-100 animate-pulse rounded mb-8" />
      <SkeletonTable rows={8} cols={6} />
    </div>
  );
}
