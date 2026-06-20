import { SkeletonTable } from '@/components/SkeletonPulse';

export default function NGODocumentsLoading() {
  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="h-8 w-52 bg-gray-200 animate-pulse rounded mb-2" />
      <div className="h-4 w-72 bg-gray-100 animate-pulse rounded mb-8" />
      <SkeletonTable rows={5} cols={5} />
    </div>
  );
}
