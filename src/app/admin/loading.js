import { SkeletonCard } from '@/components/SkeletonPulse';

export default function AdminLoading() {
  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Heading skeleton */}
      <div className="h-8 w-48 bg-gray-200 animate-pulse rounded mb-2" />
      <div className="h-4 w-72 bg-gray-100 animate-pulse rounded mb-8" />

      {/* 4 admin action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} hasIcon />
        ))}
      </div>
    </div>
  );
}
