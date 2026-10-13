export default function MyNGOsLoading() {
  return (
    <div className="w-full max-w-6xl mx-auto" aria-busy="true" aria-label="Loading your NGOs">
      <div className="h-8 w-48 bg-gray-200 animate-pulse rounded mb-2" />
      <div className="h-4 w-full max-w-md bg-gray-100 animate-pulse rounded mb-8" />
      <div className="grid gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-6 p-6 border-b border-gray-100">
              <div className="w-24 h-24 shrink-0 rounded-xl bg-gray-200 animate-pulse" />
              <div className="flex-1 space-y-3">
                <div className="h-6 w-1/2 bg-gray-200 animate-pulse rounded" />
                <div className="h-4 w-1/3 bg-gray-100 animate-pulse rounded" />
              </div>
            </div>
            <div className="p-6 space-y-2">
              <div className="h-3 w-full bg-gray-100 animate-pulse rounded" />
              <div className="h-3 w-5/6 bg-gray-100 animate-pulse rounded" />
              <div className="h-3 w-2/3 bg-gray-100 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
