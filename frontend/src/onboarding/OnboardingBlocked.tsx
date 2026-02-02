interface Props {
  companyName: string;
}

export function OnboardingBlocked({ companyName }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-amber-200 bg-amber-50/50 p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-stone-900">
          Membership expired
        </h1>
        <p className="mt-2 text-stone-600">
          The renewal date for {companyName} has passed. Access is currently
          blocked until the membership is renewed.
        </p>
        <p className="mt-4 text-sm text-stone-500">
          Please contact support or your administrator to renew.
        </p>
      </div>
    </div>
  );
}
