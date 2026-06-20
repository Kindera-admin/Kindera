import { SkeletonCard } from '@/components/SkeletonPulse';

export default function EventsLoading() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="h-7 w-36 bg-gray-200 animate-pulse rounded" />
        <div className="h-9 w-32 bg-gray-200 animate-pulse rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border border-gray-100 rounded-xl p-6 bg-white shadow-sm flex gap-5">
            {/* Image placeholder */}
            <div className="w-32 h-24 rounded-lg bg-gray-200 animate-pulse flex-shrink-0 hidden sm:block" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-3/4 bg-gray-200 animate-pulse rounded" />
              <div className="h-3 w-1/2 bg-gray-100 animate-pulse rounded" />
              <div className="h-3 w-2/3 bg-gray-100 animate-pulse rounded" />
              <div className="h-3 w-1/3 bg-gray-100 animate-pulse rounded mt-2" />
              <div className="flex gap-2 mt-3">
                <div className="h-8 w-24 bg-gray-200 animate-pulse rounded-md" />
                <div className="h-8 w-20 bg-gray-100 animate-pulse rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
