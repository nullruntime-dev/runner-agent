'use client';

interface StatusIconProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function StatusIcon({ status, size = 'md' }: StatusIconProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const iconSize = sizeClasses[size];

  switch (status) {
    case 'SUCCESS':
      return (
        <div className={`${iconSize} bg-green-500 flex items-center justify-center`}>
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    case 'FAILED':
      return (
        <div className={`${iconSize} bg-red-500 flex items-center justify-center`}>
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      );
    case 'RUNNING':
      return (
        <div className={`${iconSize} bg-amber-500 flex items-center justify-center`}>
          <svg className="w-3 h-3 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      );
    case 'CANCELLED':
      return (
        <div className={`${iconSize} bg-gray-500 flex items-center justify-center`}>
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
      );
    case 'PENDING':
    default:
      return (
        <div className={`${iconSize} bg-gray-700 flex items-center justify-center`}>
          <div className="w-1.5 h-1.5 bg-gray-400" />
        </div>
      );
  }
}
