import { Button } from '@/components/ui/button';

export default function ErrorDisplay({ 
  message = 'Something went wrong', 
  onRetry = null 
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-4 bg-red-50 border border-red-100 rounded-md">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-10 h-10 text-red-500"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <h3 className="mt-4 text-lg font-medium text-red-800">Error</h3>
      <p className="mt-2 text-gray-600">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} className="mt-4" variant="outline">
          Try Again
        </Button>
      )}
    </div>
  );
}