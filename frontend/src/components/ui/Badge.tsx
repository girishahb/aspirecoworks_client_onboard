import React from 'react';

interface BadgeProps {
  status: string;
  className?: string;
}

export default function Badge({ status, className = '' }: BadgeProps) {
  const getStatusClasses = (status: string) => {
    const normalized = status.toUpperCase();
    
    if (normalized === 'PENDING' || normalized === 'IN_PROGRESS') {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    if (normalized === 'VERIFIED' || normalized === 'APPROVED' || normalized === 'COMPLETED' || normalized === 'ACTIVE') {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    if (normalized === 'REJECTED' || normalized === 'EXPIRED') {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusClasses(status)} ${className}`}
    >
      {status}
    </span>
  );
}
