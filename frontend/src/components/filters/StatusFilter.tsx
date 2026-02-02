import React from 'react';
import Select from '../ui/Select';

interface StatusFilterProps {
  value: string;
  onChange: (value: string) => void;
  options?: Array<{ value: string; label: string }>;
  className?: string;
}

const defaultStatusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function StatusFilter({
  value,
  onChange,
  options = defaultStatusOptions,
  className = '',
}: StatusFilterProps) {
  return (
    <div className={className}>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={options}
        placeholder="Select status"
      />
    </div>
  );
}
