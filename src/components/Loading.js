export default function Loading({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px]">
      <div className="border-t-4 border-blue-500 border-solid rounded-full w-12 h-12 animate-spin"></div>
      <p className="mt-4 text-gray-600">{message}</p>
    </div>
  );
}