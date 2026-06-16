import { useMemo, useState } from 'react';
import Badge from '../Badge';
import type { CompanyPaymentHistory, PaymentGstMode } from '../../services/admin';
import { computePaymentTotals, formatInr } from '../../utils/paymentGst';
import { formatCompanyDate } from './formatting';

type Props = {
  isAggregatorView: boolean;
  showPaymentSection: boolean;
  canActivate: boolean;
  isAlreadyActive: boolean;
  canMarkKycComplete: boolean;
  activateBusy: boolean;
  kycCompleteBusy: boolean;
  paymentCreating: boolean;
  paymentResending: string | null;
  markPaidBusy: string | null;
  paymentHistory: CompanyPaymentHistory | null;
  onOpenActivateModal: () => void;
  onMarkKycComplete: () => void;
  onGeneratePaymentLink: (payload: {
    gstMode: PaymentGstMode;
    amount?: number;
    taxableAmount?: number;
    cgstRate?: number;
    sgstRate?: number;
    igstRate?: number;
  }) => void;
  onCopyPaymentLink: (link: string) => void;
  onResendPaymentLink: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
};

function paymentGstSubtext(payment: CompanyPaymentHistory['payments'][number]): string | null {
  if (payment.gstMode && payment.gstMode !== 'NONE' && payment.taxableAmount != null) {
    return `₹${formatInr(payment.taxableAmount)} + GST`;
  }
  return null;
}

export default function CompanyReviewActionsTab({
  isAggregatorView,
  showPaymentSection,
  canActivate,
  isAlreadyActive,
  canMarkKycComplete,
  activateBusy,
  kycCompleteBusy,
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
  const [includeGst, setIncludeGst] = useState(false);
  const [taxMode, setTaxMode] = useState<'CGST_SGST' | 'IGST'>('CGST_SGST');
  const [paymentAmount, setPaymentAmount] = useState('50000');
  const [taxableAmount, setTaxableAmount] = useState('5000');
  const [cgstRate, setCgstRate] = useState('5');
  const [sgstRate, setSgstRate] = useState('5');
  const [igstRate, setIgstRate] = useState('18');

  const preview = useMemo(() => {
    try {
      if (!includeGst) {
        const amount = Number.parseFloat(paymentAmount);
        if (Number.isNaN(amount) || amount <= 0) return null;
        return computePaymentTotals({ gstMode: 'NONE', amount });
      }
      const base = Number.parseFloat(taxableAmount);
      if (Number.isNaN(base) || base <= 0) return null;
      if (taxMode === 'CGST_SGST') {
        const cgst = Number.parseFloat(cgstRate);
        const sgst = Number.parseFloat(sgstRate);
        if (Number.isNaN(cgst) || Number.isNaN(sgst)) return null;
        return computePaymentTotals({
          gstMode: 'CGST_SGST',
          taxableAmount: base,
          cgstRate: cgst,
          sgstRate: sgst,
        });
      }
      const igst = Number.parseFloat(igstRate);
      if (Number.isNaN(igst)) return null;
      return computePaymentTotals({
        gstMode: 'IGST',
        taxableAmount: base,
        igstRate: igst,
      });
    } catch {
      return null;
    }
  }, [includeGst, paymentAmount, taxableAmount, taxMode, cgstRate, sgstRate, igstRate]);

  const canGenerate = preview != null && preview.totalAmount > 0;

  const pendingPayment = paymentHistory?.payments?.find((p) => p.status === 'CREATED');
  const paidPayment = paymentHistory?.payments?.find((p) => p.status === 'PAID');
  const latestPayment = paymentHistory?.payments?.[0];

  function handleGenerate() {
    if (!preview || !canGenerate) return;
    if (!includeGst) {
      onGeneratePaymentLink({ gstMode: 'NONE', amount: preview.totalAmount });
      return;
    }
    if (taxMode === 'CGST_SGST') {
      onGeneratePaymentLink({
        gstMode: 'CGST_SGST',
        taxableAmount: preview.taxableAmount,
        cgstRate: Number.parseFloat(cgstRate),
        sgstRate: Number.parseFloat(sgstRate),
      });
      return;
    }
    onGeneratePaymentLink({
      gstMode: 'IGST',
      taxableAmount: preview.taxableAmount,
      igstRate: Number.parseFloat(igstRate),
    });
  }

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
            <div className="mb-4 space-y-4">
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={includeGst}
                  onChange={(e) => setIncludeGst(e.target.checked)}
                  disabled={paymentCreating}
                />
                Include GST in payment link
              </label>

              {!includeGst ? (
                <div>
                  <label htmlFor="payment-amount-actions" className="mb-1 block text-sm text-slate-700">
                    Amount (₹)
                  </label>
                  <input
                    id="payment-amount-actions"
                    type="number"
                    min={1}
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    disabled={paymentCreating}
                    className="w-48 rounded border border-slate-300 px-2 py-2"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-slate-700">Tax type</legend>
                    <label className="mr-4 inline-flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="payment-tax-mode"
                        checked={taxMode === 'CGST_SGST'}
                        onChange={() => setTaxMode('CGST_SGST')}
                        disabled={paymentCreating}
                      />
                      CGST + SGST
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="payment-tax-mode"
                        checked={taxMode === 'IGST'}
                        onChange={() => setTaxMode('IGST')}
                        disabled={paymentCreating}
                      />
                      IGST
                    </label>
                  </fieldset>

                  <div>
                    <label htmlFor="payment-taxable-amount" className="mb-1 block text-sm text-slate-700">
                      Base amount (₹)
                    </label>
                    <input
                      id="payment-taxable-amount"
                      type="number"
                      min={1}
                      step="0.01"
                      value={taxableAmount}
                      onChange={(e) => setTaxableAmount(e.target.value)}
                      disabled={paymentCreating}
                      className="w-48 rounded border border-slate-300 px-2 py-2"
                    />
                  </div>

                  {taxMode === 'CGST_SGST' ? (
                    <div className="flex flex-wrap gap-4">
                      <div>
                        <label htmlFor="payment-cgst-rate" className="mb-1 block text-sm text-slate-700">
                          CGST (%)
                        </label>
                        <input
                          id="payment-cgst-rate"
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={cgstRate}
                          onChange={(e) => setCgstRate(e.target.value)}
                          disabled={paymentCreating}
                          className="w-28 rounded border border-slate-300 px-2 py-2"
                        />
                      </div>
                      <div>
                        <label htmlFor="payment-sgst-rate" className="mb-1 block text-sm text-slate-700">
                          SGST (%)
                        </label>
                        <input
                          id="payment-sgst-rate"
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={sgstRate}
                          onChange={(e) => setSgstRate(e.target.value)}
                          disabled={paymentCreating}
                          className="w-28 rounded border border-slate-300 px-2 py-2"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="payment-igst-rate" className="mb-1 block text-sm text-slate-700">
                        IGST (%)
                      </label>
                      <input
                        id="payment-igst-rate"
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={igstRate}
                        onChange={(e) => setIgstRate(e.target.value)}
                        disabled={paymentCreating}
                        className="w-28 rounded border border-slate-300 px-2 py-2"
                      />
                    </div>
                  )}
                </div>
              )}

              {preview && (
                <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-800">
                  {includeGst && (
                    <>
                      <p>Base: ₹{formatInr(preview.taxableAmount)}</p>
                      {preview.cgstAmount > 0 && (
                        <p>
                          CGST ({preview.cgstRate}%): ₹{formatInr(preview.cgstAmount)}
                        </p>
                      )}
                      {preview.sgstAmount > 0 && (
                        <p>
                          SGST ({preview.sgstRate}%): ₹{formatInr(preview.sgstAmount)}
                        </p>
                      )}
                      {preview.igstAmount > 0 && (
                        <p>
                          IGST ({preview.igstRate}%): ₹{formatInr(preview.igstAmount)}
                        </p>
                      )}
                    </>
                  )}
                  <p className="font-semibold text-slate-900">
                    Total payable: ₹{formatInr(preview.totalAmount)}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerate}
                disabled={paymentCreating || !canGenerate}
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
              {paymentGstSubtext(latestPayment) && (
                <span className="text-xs text-slate-500">({paymentGstSubtext(latestPayment)})</span>
              )}
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
