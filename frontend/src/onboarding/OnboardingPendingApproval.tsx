import { Link } from 'react-router-dom';

interface Props {
  companyName: string;
}

export function OnboardingPendingApproval({ companyName }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-stone-900">
          Under review
        </h1>
        <p className="mt-2 text-stone-600">
          Documents for {companyName} have been submitted and are pending
          approval. We’ll notify you once the review is complete.
        </p>
        <p className="mt-4 text-sm text-stone-500">
          You can check back later or contact support if you have questions.
        </p>
        <Link
          to="/onboarding/waiting"
          className="mt-6 inline-block rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
        >
          View document status
        </Link>
      </div>
    </div>
  );
}
