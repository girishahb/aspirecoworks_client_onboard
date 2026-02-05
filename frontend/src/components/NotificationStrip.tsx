import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';

export interface NotificationStripProps {
  /** Notification type */
  type?: 'info' | 'warning' | 'error' | 'success';
  /** Notification message */
  message: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Dismissible */
  dismissible?: boolean;
}

export default function NotificationStrip({
  type = 'info',
  message,
  action,
  dismissible = true,
}: NotificationStripProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const typeStyles = {
    info: 'bg-primary/10 border-primary/20 text-primary',
    warning: 'bg-accent/10 border-accent/20 text-accent',
    error: 'bg-error/10 border-error/20 text-error',
    success: 'bg-success/10 border-success/20 text-success',
  };

  return (
    <div
      className={`mb-4 flex items-start gap-3 rounded-lg border p-4 ${typeStyles[type]}`}
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
      <div className="flex-1">
        <p className="text-sm font-medium">{message}</p>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-2 text-sm font-semibold underline hover:no-underline"
          >
            {action.label}
          </button>
        )}
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-current opacity-60 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
