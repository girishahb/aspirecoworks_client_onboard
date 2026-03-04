import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Globe } from 'lucide-react';

const RESOURCE_LABELS: Record<string, string> = {
  CONFERENCE_ROOM: 'Conference Room',
  DISCUSSION_ROOM: 'Discussion Room',
  DAY_PASS_DESK: 'Day Pass Desk',
};

export default function BookSuccess() {
  const locationState = useLocation().state as {
    resourceType?: string;
    locationName?: string;
    date?: string;
    timeSlot?: string;
    quantity?: number;
    amount?: number;
  } | null;

  const websiteUrl = import.meta.env.VITE_WEBSITE_URL || '/';

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 bg-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-lg w-full rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-2px_rgba(0,0,0,0.05)] text-center"
      >
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-100 text-emerald-600 mb-6">
          <CheckCircle2 className="w-14 h-14" strokeWidth={2} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
          Booking Confirmed!
        </h1>
        <p className="text-slate-600 mb-8">
          Your Aspire Coworks booking has been confirmed. A confirmation email has been sent to your
          inbox.
        </p>

        {locationState && (
          <div className="text-left p-6 rounded-2xl bg-slate-50 border border-slate-200 mb-8 space-y-2">
            {locationState.locationName && (
              <p className="text-sm">
                <span className="font-medium text-slate-700">Location:</span>{' '}
                <span className="text-slate-900">{locationState.locationName}</span>
              </p>
            )}
            {locationState.resourceType && (
              <p className="text-sm">
                <span className="font-medium text-slate-700">Resource:</span>{' '}
                <span className="text-slate-900">
                  {RESOURCE_LABELS[locationState.resourceType] ?? locationState.resourceType.replace(/_/g, ' ')}
                </span>
              </p>
            )}
            {locationState.date && (
              <p className="text-sm">
                <span className="font-medium text-slate-700">Date:</span>{' '}
                <span className="text-slate-900">
                  {new Date(locationState.date).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </p>
            )}
            {locationState.timeSlot && (
              <p className="text-sm">
                <span className="font-medium text-slate-700">Time:</span>{' '}
                <span className="text-slate-900">{locationState.timeSlot}</span>
              </p>
            )}
            {locationState.quantity != null && locationState.quantity > 1 && (
              <p className="text-sm">
                <span className="font-medium text-slate-700">Quantity:</span>{' '}
                <span className="text-slate-900">{locationState.quantity}</span>
              </p>
            )}
            {locationState.amount != null && (
              <p className="text-sm pt-2 border-t border-slate-200 mt-2">
                <span className="font-medium text-slate-700">Amount paid:</span>{' '}
                <span className="text-slate-900 font-semibold">
                  ₹{locationState.amount.toLocaleString('en-IN')}
                </span>
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/book"
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
          >
            Book Another Space
          </Link>
          <a
            href={websiteUrl}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
          >
            <Globe className="w-4 h-4" />
            Visit Website
          </a>
        </div>
      </motion.div>
    </div>
  );
}
