import { SkeletonTable } from '@/components/SkeletonPulse';

export default function ReportsLoading() {
  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="h-7 w-36 bg-gray-200 animate-pulse rounded" />
        <div className="h-9 w-32 bg-gray-200 animate-pulse rounded-md" />
      </div>
      {/* Filter bar */}
      <div className="h-10 w-56 bg-gray-100 animate-pulse rounded-md mb-6" />
      <SkeletonTable rows={8} cols={6} />
    </div>
  );
}
