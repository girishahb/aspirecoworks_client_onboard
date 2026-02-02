import React, { useState } from 'react';
import Button from '../ui/Button';

interface FilterPanelProps {
  children: React.ReactNode;
  onClear?: () => void;
  className?: string;
}

export default function FilterPanel({ children, onClear, className = '' }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900">Filters</h3>
        <div className="flex items-center space-x-2">
          {onClear && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onClear}
            >
              Clear
            </Button>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="p-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}
