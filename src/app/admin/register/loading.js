import { SkeletonForm } from '@/components/SkeletonPulse';

export default function AdminRegisterLoading() {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="h-7 w-40 bg-gray-200 animate-pulse rounded mb-6" />
      <SkeletonForm fields={7} />
    </div>
  );
}
