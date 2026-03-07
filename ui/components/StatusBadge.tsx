'use client';

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    RUNNING: 'bg-blue-100 text-blue-800 border-blue-300 animate-pulse',
    SUCCESS: 'bg-green-100 text-green-800 border-green-300',
    FAILED: 'bg-red-100 text-red-800 border-red-300',
    CANCELLED: 'bg-gray-100 text-gray-800 border-gray-300',
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded border ${
        styles[status] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {status}
    </span>
  );
}
