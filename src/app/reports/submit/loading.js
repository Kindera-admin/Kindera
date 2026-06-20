import { SkeletonForm } from '@/components/SkeletonPulse';

export default function ReportsSubmitLoading() {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="h-7 w-44 bg-gray-200 animate-pulse rounded mb-2" />
      <div className="h-4 w-72 bg-gray-100 animate-pulse rounded mb-6" />
      <SkeletonForm fields={5} />
    </div>
  );
}
