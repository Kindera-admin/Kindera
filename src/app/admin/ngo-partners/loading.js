import { SkeletonCard } from '@/components/SkeletonPulse';

export default function AdminNGOPartnersLoading() {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="h-7 w-44 bg-gray-200 animate-pulse rounded" />
        <div className="h-9 w-32 bg-gray-200 animate-pulse rounded-md" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} lines={3} hasButton />
        ))}
      </div>
    </div>
  );
}
