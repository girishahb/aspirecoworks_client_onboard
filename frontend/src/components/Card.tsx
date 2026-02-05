import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Card container for dashboard sections. Border, rounded corners, padding.
 */
export default function Card({ title, children, className = '' }: CardProps) {
  return (
    <section
      className={`rounded-lg border border-border bg-white p-6 shadow-sm ${className}`.trim()}
    >
      {title && (
        <h2 className="mb-4 text-lg font-semibold text-text border-b border-border pb-2">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
