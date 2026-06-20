import { SkeletonCard } from '@/components/SkeletonPulse';

export default function HomeLoading() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Welcome banner */}
      <div className="h-8 w-56 bg-gray-200 animate-pulse rounded mb-2" />
      <div className="h-4 w-72 bg-gray-100 animate-pulse rounded mb-8" />

      {/* Upcoming events */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div className="h-6 w-40 bg-gray-200 animate-pulse rounded" />
          <div className="h-9 w-32 bg-gray-100 animate-pulse rounded-md" />
        </div>
        <SkeletonCard lines={2} hasButton />
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} hasButton />
        ))}
      </div>
    </div>
  );
}
