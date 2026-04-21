import Badge from '../Badge';
import type { CompanyPaymentHistory } from '../../services/admin';
import { formatCompanyDate } from './formatting';

type Props = {
  isAggregatorView: boolean;
  /** Direct channel payment section */
  showPaymentSection: boolean;
  canActivate: boolean;
  isAlreadyActive: boolean;
  canMarkKycComplete: boolean;
  activateBusy: boolean;
  kycCompleteBusy: boolean;
  paymentAmount: string;
  setPaymentAmount: (v: string) => void;
  paymentCreating: boolean;
  paymentResending: string | null;
  markPaidBusy: string | null;
  paymentHistory: CompanyPaymentHistory | null;
  onOpenActivateModal: () => void;
  onMarkKycComplete: () => void;
  onGeneratePaymentLink: () => void;
  onCopyPaymentLink: (link: string) => void;
  onResendPaymentLink: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
};

export default function CompanyReviewActionsTab({
  isAggregatorView,
  showPaymentSection,
  canActivate,
  isAlreadyActive,
  canMarkKycComplete,
  activateBusy,
  kycCompleteBusy,
  paymentAmount,
  setPaymentAmount,
  paymentCreating,
  paymentResending,
  markPaidBusy,
  paymentHistory,
  onOpenActivateModal,
  onMarkKycComplete,
  onGeneratePaymentLink,
  onCopyPaymentLink,
  onResendPaymentLink,
  onMarkAsPaid,
}: Props) {
  const pendingPayment = paymentHistory?.payments?.find((p) => p.status === 'CREATED');
  const paidPayment = paymentHistory?.payments?.find((p) => p.status === 'PAID');
  const latestPayment = paymentHistory?.payments?.[0];

  return (
    <section
      className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      role="tabpanel"
      id="company-review-panel-actions"
      aria-labelledby="company-review-tab-actions"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Actions</h2>
        <p className="mt-1 text-sm text-slate-600">
          {isAggregatorView
            ? 'Lifecycle actions such as activation and payments are managed by Aspire admins. Use Overview and other tabs for client details and documents.'
            : 'Activate the company, collect payment, and advance onboarding when requirements are met.'}
        </p>
      </div>

      {isAggregatorView && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          You can resend the client invite from the <strong>Overview</strong> tab when the stage allows it. For
          activation and payments, contact your Aspire administrator.
        </p>
      )}

      {!isAggregatorView && canMarkKycComplete && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4">
          <p className="mb-3 text-sm text-green-900">
            All KYC documents approved. Mark KYC review complete and move to Agreement draft stage.
          </p>
          <button
            type="button"
            onClick={onMarkKycComplete}
            disabled={kycCompleteBusy}
            className="rounded bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {kycCompleteBusy ? 'Updating…' : 'Mark KYC Review Complete'}
          </button>
        </div>
      )}

      {!isAggregatorView && (
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="mt-0 text-base font-semibold text-slate-900">Activate company</h3>
          <p className="text-sm text-slate-600">
            Available when stage is &quot;Final agreement shared&quot;. Aggregator clients require contract dates.
          </p>
          <div className="mt-3">
            {isAlreadyActive ? (
              <button
                type="button"
                disabled
                className="cursor-default rounded-md border-2 border-green-800 bg-green-800 px-5 py-2.5 text-base font-bold text-white"
              >
                ✓ Company Activated
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenActivateModal}
                disabled={!canActivate || activateBusy}
                className={
                  canActivate
                    ? 'rounded-md border-2 border-sky-800 bg-sky-800 px-5 py-2.5 text-base font-bold text-white disabled:opacity-70'
                    : 'cursor-not-allowed rounded-md border-2 border-slate-400 bg-slate-400 px-5 py-2.5 text-base font-bold text-white'
                }
              >
                {activateBusy ? 'Activating…' : 'Activate Company'}
              </button>
            )}
            {!canActivate && !isAlreadyActive && (
              <p className="mt-2 text-sm text-slate-500">Activate only when stage is &quot;Final agreement shared&quot;.</p>
            )}
          </div>
        </div>
      )}

      {!isAggregatorView && showPaymentSection && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-5">
          <h3 className="mt-0 text-base font-semibold text-slate-900">Payment</h3>
          {!pendingPayment && !paidPayment && (
            <div className="mb-4">
              <label htmlFor="payment-amount-actions" className="mb-1 block text-sm text-slate-700">
                Amount (₹)
              </label>
              <input
                id="payment-amount-actions"
                type="number"
                min={1}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                disabled={paymentCreating}
                className="mr-2 w-48 rounded border border-slate-300 px-2 py-2"
              />
              <button
                type="button"
                onClick={onGeneratePaymentLink}
                disabled={paymentCreating}
                className="rounded bg-sky-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {paymentCreating ? 'Generating…' : 'Generate Payment Link'}
              </button>
            </div>
          )}
          {latestPayment && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  latestPayment.status === 'PAID'
                    ? 'approved'
                    : latestPayment.status === 'FAILED'
                      ? 'rejected'
                      : 'pending'
                }
              >
                {latestPayment.status === 'CREATED'
                  ? 'Link created'
                  : latestPayment.status === 'PAID'
                    ? 'Paid'
                    : 'Failed'}
              </Badge>
              {latestPayment.paidAt && (
                <span className="text-sm text-slate-600">Paid on {formatCompanyDate(latestPayment.paidAt)}</span>
              )}
              <span className="text-sm">
                ₹{latestPayment.amount.toLocaleString('en-IN')} {latestPayment.currency}
              </span>
            </div>
          )}
          {pendingPayment?.paymentLink && (
            <div className="mt-3">
              <label className="mb-1 block text-sm text-slate-700">Payment link</label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={pendingPayment.paymentLink}
                  className="min-w-[200px] flex-1 rounded border border-slate-300 px-2 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => onCopyPaymentLink(pendingPayment.paymentLink!)}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
                >
                  Copy link
                </button>
                <button
                  type="button"
                  onClick={() => onResendPaymentLink(pendingPayment.id)}
                  disabled={paymentResending === pendingPayment.id}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
                >
                  {paymentResending === pendingPayment.id ? 'Sending…' : 'Send to client'}
                </button>
                <button
                  type="button"
                  onClick={() => onMarkAsPaid(pendingPayment.id)}
                  disabled={markPaidBusy === pendingPayment.id}
                  className="rounded border border-green-800 bg-green-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  {markPaidBusy === pendingPayment.id ? 'Updating…' : 'Mark as paid'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
