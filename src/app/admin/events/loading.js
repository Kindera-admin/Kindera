import { SkeletonTable } from '@/components/SkeletonPulse';

export default function AdminEventsLoading() {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="h-7 w-40 bg-gray-200 animate-pulse rounded" />
        <div className="h-9 w-32 bg-gray-200 animate-pulse rounded-md" />
      </div>
      <SkeletonTable rows={7} cols={5} />
    </div>
  );
}
