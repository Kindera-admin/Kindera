// Reusable skeleton/pulse components for loading states across the Kindera platform.
// All skeletons match the brand's neutral palette and card structure.

export function SkeletonBlock({ className = '' }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-md ${className}`} />
  );
}

export function SkeletonCard({ lines = 3, hasIcon = false, hasButton = false }) {
  return (
    <div className="border border-gray-100 rounded-xl p-6 bg-white shadow-sm">
      {hasIcon && (
        <div className="w-11 h-11 rounded-lg bg-gray-200 animate-pulse mb-4" />
      )}
      <div className="h-5 w-2/3 bg-gray-200 animate-pulse rounded mb-2" />
      <div className="space-y-2 mb-4">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 bg-gray-100 animate-pulse rounded"
            style={{ width: `${85 - i * 12}%` }}
          />
        ))}
      </div>
      {hasButton && (
        <div className="h-9 w-28 bg-gray-200 animate-pulse rounded-md" />
      )}
    </div>
  );
}

export function SkeletonTableRow({ cols = 5 }) {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 animate-pulse rounded" style={{ width: `${60 + (i % 3) * 15}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 6, cols = 5, title = '' }) {
  return (
    <div className="w-full">
      {title && <div className="h-7 w-48 bg-gray-200 animate-pulse rounded mb-6" />}
      <div className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <div className="h-3 w-20 bg-gray-300 animate-pulse rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <SkeletonTableRow key={i} cols={cols} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SkeletonFormField() {
  return (
    <div className="space-y-1.5">
      <div className="h-3.5 w-24 bg-gray-200 animate-pulse rounded" />
      <div className="h-10 w-full bg-gray-100 animate-pulse rounded-md" />
    </div>
  );
}

export function SkeletonForm({ fields = 6, title = '' }) {
  return (
    <div className="border border-gray-100 rounded-xl p-8 bg-white shadow-sm">
      {title && <div className="h-7 w-52 bg-gray-200 animate-pulse rounded mb-6" />}
      <div className="space-y-5">
        {Array.from({ length: fields }).map((_, i) => (
          <SkeletonFormField key={i} />
        ))}
      </div>
      <div className="h-10 w-36 bg-gray-300 animate-pulse rounded-md mt-8" />
    </div>
  );
}
