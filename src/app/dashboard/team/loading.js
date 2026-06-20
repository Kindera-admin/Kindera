import { SkeletonTable } from '@/components/SkeletonPulse';

export default function TeamLoading() {
  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="h-8 w-64 bg-gray-200 animate-pulse rounded mb-2" />
      <div className="h-4 w-96 bg-gray-100 animate-pulse rounded mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white border border-gray-100 rounded-xl animate-pulse" />)}
      </div>
      <SkeletonTable rows={5} cols={4} />
    </div>
  );
}
