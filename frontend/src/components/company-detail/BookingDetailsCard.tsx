import type { AggregatorBooking } from '../../services/aggregatorProfile';

function maskAadhaar(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return value;
  const last4 = digits.slice(-4);
  return `XXXX XXXX ${last4}`;
}

function BookingField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[0.72rem] font-semibold uppercase tracking-wide text-amber-800">{label}</div>
      <div className="text-[0.9rem] text-slate-900">{value || '—'}</div>
    </div>
  );
}

/** Read-only booking card for aggregator-channel clients. */
export default function BookingDetailsCard({ bookings }: { bookings: AggregatorBooking[] }) {
  return (
    <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[1.05rem] font-semibold text-amber-900">Booking details</h2>
        <span className="text-xs text-amber-800">Submitted by the aggregator at client registration.</span>
      </div>

      {bookings.map((b, idx) => (
        <div
          key={b.id}
          className={idx === 0 ? 'mt-3' : 'mt-4 border-t border-dashed border-amber-200 pt-4'}
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-5 gap-y-2.5 text-sm text-slate-900">
            <BookingField label="Booking ID" value={b.bookingReference} />
            <BookingField label="Plan type" value={b.planType} />
            <BookingField label="Venue" value={b.venueName} />
            <BookingField
              label="Duration"
              value={
                b.durationMonths != null
                  ? `${b.durationMonths} month${b.durationMonths === 1 ? '' : 's'}`
                  : null
              }
            />
            <BookingField
              label="Amount"
              value={
                b.amount != null
                  ? `${b.currency ?? 'INR'} ${b.amount}${b.gstApplicable ? ' + GST' : ''}`
                  : null
              }
            />
            <BookingField label="Client contact" value={b.clientContactName} />
            <BookingField label="POC" value={b.pocName} />
            <BookingField label="POC contact" value={b.pocContact} />
            <BookingField label="Father / spouse name" value={b.clientFatherOrSpouseName} />
            <BookingField label="Client PAN" value={b.clientPan} />
            <BookingField label="Client Aadhaar" value={maskAadhaar(b.clientAadhaar)} />
          </div>

          {b.venueAddress && (
            <div className="mt-3 text-sm text-slate-700">
              <div className="text-[0.75rem] font-semibold uppercase tracking-wide text-slate-600">
                Venue address
              </div>
              <div className="whitespace-pre-line">{b.venueAddress}</div>
            </div>
          )}

          {(b.paymentTerms || b.signageTerms) && (
            <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3 text-sm text-slate-700">
              {b.paymentTerms && (
                <div>
                  <div className="text-[0.75rem] font-semibold uppercase tracking-wide text-slate-600">
                    Payment terms
                  </div>
                  <div className="whitespace-pre-line">{b.paymentTerms}</div>
                </div>
              )}
              {b.signageTerms && (
                <div>
                  <div className="text-[0.75rem] font-semibold uppercase tracking-wide text-slate-600">
                    Signage terms
                  </div>
                  <div className="whitespace-pre-line">{b.signageTerms}</div>
                </div>
              )}
            </div>
          )}

          {(b.invoiceLegalName ||
            b.invoiceGstin ||
            b.invoicePan ||
            b.invoiceConstitution ||
            b.invoiceRegisteredAddress) && (
            <div className="mt-4 border-t border-dashed border-amber-200 pt-3">
              <div className="mb-1 text-[0.8rem] font-semibold uppercase tracking-wide text-amber-900">
                Invoice to
              </div>
              <div className="text-[0.9rem] font-semibold text-slate-900">{b.invoiceLegalName ?? '—'}</div>
              {b.invoiceConstitution && (
                <div className="text-sm text-slate-600">{b.invoiceConstitution}</div>
              )}
              {(b.invoiceGstin || b.invoicePan) && (
                <div className="mt-1 text-sm text-slate-600">
                  {b.invoiceGstin && (
                    <>
                      GSTIN: <strong>{b.invoiceGstin}</strong>
                    </>
                  )}
                  {b.invoiceGstin && b.invoicePan && <span> · </span>}
                  {b.invoicePan && (
                    <>
                      PAN: <strong>{b.invoicePan}</strong>
                    </>
                  )}
                </div>
              )}
              {b.invoiceRegisteredAddress && (
                <div className="mt-1 whitespace-pre-line text-sm text-slate-600">{b.invoiceRegisteredAddress}</div>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
