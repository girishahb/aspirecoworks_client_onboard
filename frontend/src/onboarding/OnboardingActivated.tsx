import { Link } from 'react-router-dom';

interface Props {
  companyName: string;
  renewalDate: string | null;
}

function formatRenewalDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function OnboardingActivated({ companyName, renewalDate }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-stone-200/80 bg-white p-10 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Your company is now active
          </h1>
          <p className="mt-4 text-stone-600 leading-relaxed">
            You’re all set. Your account is active and you can use the platform as usual.
          </p>
        </div>

        <dl className="mt-8 space-y-5 border-t border-stone-100 pt-8">
          <div>
            <dt className="text-sm font-medium text-stone-500">Company</dt>
            <dd className="mt-1 text-stone-900">{companyName}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-stone-500">Renewal date</dt>
            <dd className="mt-1 text-stone-900">{formatRenewalDate(renewalDate)}</dd>
          </div>
        </dl>

        <div className="mt-10">
          <Link
            to="/dashboard"
            className="block w-full rounded-xl bg-stone-900 py-3 text-center text-sm font-medium text-white hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-500 focus:ring-offset-2"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
