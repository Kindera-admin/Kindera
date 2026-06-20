import { SkeletonTable } from '@/components/SkeletonPulse';

export default function AdminUsersLoading() {
  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="h-7 w-36 bg-gray-200 animate-pulse rounded" />
        <div className="h-9 w-24 bg-gray-100 animate-pulse rounded-md" />
      </div>
      {/* Search/filter bar skeleton */}
      <div className="h-10 w-full max-w-sm bg-gray-100 animate-pulse rounded-md mb-6" />
      <SkeletonTable rows={8} cols={6} />
    </div>
  );
}
