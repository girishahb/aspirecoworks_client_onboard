import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createCompany } from '../services/admin';
import { uploadAggregatorKyc } from '../services/documents';
import {
  getMyInvoiceProfile,
  type AggregatorInvoiceProfile,
} from '../services/aggregatorProfile';

const inputClass =
  'block w-full rounded-md border border-border bg-white px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60';

type KycDocType = 'AADHAAR' | 'PAN' | 'OTHER';

const KYC_TYPE_OPTIONS: { value: KycDocType; label: string }[] = [
  { value: 'AADHAAR', label: 'Aadhaar' },
  { value: 'PAN', label: 'PAN' },
  { value: 'OTHER', label: 'Other' },
];

const PLAN_TYPE_SUGGESTIONS = ['BR', 'Enterprise', 'Startup', 'Virtual Office', 'Day Pass'];

const DEFAULT_PAYMENT_TERMS = '100% payment upfront in the next monthly billing cycle';
const DEFAULT_SIGNAGE_TERMS =
  'Complimentary verification signage / sticker (anywhere in the premises)';

type KycItemStatus = 'pending' | 'uploading' | 'done' | 'error';

interface KycItem {
  id: string;
  file: File;
  documentType: KycDocType;
  status: KycItemStatus;
  error?: string;
}

interface BookingState {
  bookingReference: string;
  planType: string;
  venueName: string;
  venueAddress: string;
  durationMonths: string;
  amount: string;
  currency: string;
  gstApplicable: boolean;
  paymentTerms: string;
  signageTerms: string;
  clientContactName: string;
  pocName: string;
  pocContact: string;
}

interface InvoiceToState {
  legalName: string;
  constitution: string;
  gstin: string;
  pan: string;
  registeredAddress: string;
}

const EMPTY_INVOICE_TO: InvoiceToState = {
  legalName: '',
  constitution: '',
  gstin: '',
  pan: '',
  registeredAddress: '',
};

function toInvoiceToState(profile: AggregatorInvoiceProfile | null): InvoiceToState {
  if (!profile) return EMPTY_INVOICE_TO;
  return {
    legalName: profile.legalName ?? '',
    constitution: profile.constitution ?? '',
    gstin: profile.gstin ?? '',
    pan: profile.pan ?? '',
    registeredAddress: profile.registeredAddress ?? '',
  };
}

function invoiceToEquals(a: InvoiceToState, b: InvoiceToState): boolean {
  return (
    a.legalName.trim() === b.legalName.trim() &&
    a.constitution.trim() === b.constitution.trim() &&
    a.gstin.trim().toUpperCase() === b.gstin.trim().toUpperCase() &&
    a.pan.trim().toUpperCase() === b.pan.trim().toUpperCase() &&
    a.registeredAddress.trim() === b.registeredAddress.trim()
  );
}

function inferKycType(fileName: string): KycDocType {
  const lower = fileName.toLowerCase();
  if (lower.includes('aadhaar') || lower.includes('aadhar') || lower.includes('uidai')) return 'AADHAAR';
  if (lower.includes('pan')) return 'PAN';
  return 'OTHER';
}

export default function AggregatorCreateCompany() {
  const navigate = useNavigate();
  const backPath = '/aggregator/dashboard';
  const detailPathPrefix = '/aggregator/companies';

  const [formData, setFormData] = useState({
    companyName: '',
    contactEmail: '',
    contactPhone: '',
    taxId: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    notes: '',
  });

  const [booking, setBooking] = useState<BookingState>({
    bookingReference: '',
    planType: '',
    venueName: '',
    venueAddress: '',
    durationMonths: '',
    amount: '',
    currency: 'INR',
    gstApplicable: true,
    paymentTerms: DEFAULT_PAYMENT_TERMS,
    signageTerms: DEFAULT_SIGNAGE_TERMS,
    clientContactName: '',
    pocName: '',
    pocContact: '',
  });

  const [invoiceTo, setInvoiceTo] = useState<InvoiceToState>(EMPTY_INVOICE_TO);
  const [savedInvoiceTo, setSavedInvoiceTo] = useState<InvoiceToState | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [customizeInvoiceTo, setCustomizeInvoiceTo] = useState(false);
  const [saveInvoiceToProfile, setSaveInvoiceToProfile] = useState(false);

  const [kycItems, setKycItems] = useState<KycItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'idle' | 'creating' | 'uploading' | 'done'>(
    'idle',
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setProfileLoading(true);
      try {
        const profile = await getMyInvoiceProfile();
        if (cancelled) return;
        const mapped = toInvoiceToState(profile);
        setSavedInvoiceTo(profile ? mapped : null);
        setInvoiceTo(mapped);
        if (!profile) {
          setCustomizeInvoiceTo(true);
          setSaveInvoiceToProfile(true);
        }
      } catch {
        if (!cancelled) {
          setSavedInvoiceTo(null);
          setInvoiceTo(EMPTY_INVOICE_TO);
          setCustomizeInvoiceTo(true);
          setSaveInvoiceToProfile(true);
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleBookingChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const target = e.target;
    const name = target.name as keyof BookingState;
    if (target.type === 'checkbox' && target instanceof HTMLInputElement) {
      setBooking((prev) => ({ ...prev, [name]: target.checked }));
      return;
    }
    setBooking((prev) => ({ ...prev, [name]: target.value }));
  }

  function handleInvoiceToChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target;
    setInvoiceTo((prev) => ({ ...prev, [name]: value }));
  }

  function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const now = Date.now();
    const next: KycItem[] = Array.from(files).map((file, i) => ({
      id: `${now}-${i}-${file.name}`,
      file,
      documentType: inferKycType(file.name),
      status: 'pending',
    }));
    setKycItems((prev) => [...prev, ...next]);
  }

  function updateItem(id: string, patch: Partial<KycItem>) {
    setKycItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(id: string) {
    setKycItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formData.companyName.trim() || !formData.contactEmail.trim()) {
      setError('Company name and contact email are required.');
      return;
    }

    setSubmitting(true);
    setCurrentStep('creating');

    try {
      const data: any = {
        companyName: formData.companyName.trim(),
        contactEmail: formData.contactEmail.trim(),
      };
      if (formData.contactPhone.trim()) data.contactPhone = formData.contactPhone.trim();
      if (formData.taxId.trim()) data.taxId = formData.taxId.trim();
      if (formData.address.trim()) data.address = formData.address.trim();
      if (formData.city.trim()) data.city = formData.city.trim();
      if (formData.state.trim()) data.state = formData.state.trim();
      if (formData.zipCode.trim()) data.zipCode = formData.zipCode.trim();
      if (formData.country.trim()) data.country = formData.country.trim();
      if (formData.notes.trim()) data.notes = formData.notes.trim();

      // Booking payload – include only non-empty values.
      const bookingPayload: Record<string, any> = {};
      if (booking.bookingReference.trim())
        bookingPayload.bookingReference = booking.bookingReference.trim();
      if (booking.planType.trim()) bookingPayload.planType = booking.planType.trim();
      if (booking.venueName.trim()) bookingPayload.venueName = booking.venueName.trim();
      if (booking.venueAddress.trim()) bookingPayload.venueAddress = booking.venueAddress.trim();
      if (booking.durationMonths.trim()) {
        const d = Number(booking.durationMonths);
        if (Number.isFinite(d) && d > 0) bookingPayload.durationMonths = d;
      }
      if (booking.amount.trim()) {
        const a = Number(booking.amount);
        if (Number.isFinite(a) && a >= 0) bookingPayload.amount = a;
      }
      if (booking.currency.trim()) bookingPayload.currency = booking.currency.trim().toUpperCase();
      bookingPayload.gstApplicable = booking.gstApplicable;
      if (booking.paymentTerms.trim()) bookingPayload.paymentTerms = booking.paymentTerms.trim();
      if (booking.signageTerms.trim()) bookingPayload.signageTerms = booking.signageTerms.trim();
      if (booking.clientContactName.trim())
        bookingPayload.clientContactName = booking.clientContactName.trim();
      if (booking.pocName.trim()) bookingPayload.pocName = booking.pocName.trim();
      if (booking.pocContact.trim()) bookingPayload.pocContact = booking.pocContact.trim();
      if (Object.keys(bookingPayload).length > 0) data.booking = bookingPayload;

      // Invoice-To logic:
      // - If user is not customizing and we have a saved profile, omit invoiceTo (server uses saved profile).
      // - If customizing, send the current fields and optionally ask to persist them as the default.
      const isCustomizing = !savedInvoiceTo || customizeInvoiceTo;
      if (isCustomizing) {
        const invoiceToPayload: Record<string, any> = {};
        if (invoiceTo.legalName.trim()) invoiceToPayload.legalName = invoiceTo.legalName.trim();
        if (invoiceTo.constitution.trim())
          invoiceToPayload.constitution = invoiceTo.constitution.trim();
        if (invoiceTo.gstin.trim()) invoiceToPayload.gstin = invoiceTo.gstin.trim().toUpperCase();
        if (invoiceTo.pan.trim()) invoiceToPayload.pan = invoiceTo.pan.trim().toUpperCase();
        if (invoiceTo.registeredAddress.trim())
          invoiceToPayload.registeredAddress = invoiceTo.registeredAddress.trim();
        if (Object.keys(invoiceToPayload).length > 0) data.invoiceTo = invoiceToPayload;
        if (saveInvoiceToProfile && invoiceToPayload.legalName) {
          data.saveInvoiceToProfile = true;
        }
      }

      const company = await createCompany(data);

      if (kycItems.length > 0) {
        setCurrentStep('uploading');
        let hadError = false;
        for (const item of kycItems) {
          updateItem(item.id, { status: 'uploading', error: undefined });
          try {
            await uploadAggregatorKyc(company.id, item.file, item.documentType);
            updateItem(item.id, { status: 'done' });
          } catch (err) {
            hadError = true;
            updateItem(item.id, {
              status: 'error',
              error: err instanceof Error ? err.message : 'Upload failed',
            });
          }
        }
        if (hadError) {
          setError(
            'The client was created, but one or more KYC documents failed to upload. ' +
              'You can retry missing documents from the client detail page.',
          );
          setCurrentStep('done');
          setSubmitting(false);
          navigate(`${detailPathPrefix}/${company.id}`, {
            replace: true,
            state: { inviteSent: true, kycPartial: true },
          });
          return;
        }
      }

      setCurrentStep('done');
      navigate(`${detailPathPrefix}/${company.id}`, {
        replace: true,
        state: { inviteSent: true },
      });
    } catch (err) {
      let errorMessage = 'Failed to create company';
      if (err instanceof Error) {
        errorMessage = err.message;
        if (errorMessage === 'Validation failed' && (err as any).response) {
          const response = (err as any).response;
          if (response.errors && Array.isArray(response.errors)) {
            const details = response.errors
              .map((e2: any) => `${e2.path || 'field'}: ${e2.message || e2}`)
              .join('\n');
            errorMessage = `Validation failed:\n${details}`;
          } else if (response.message && response.message !== 'Validation failed') {
            errorMessage = response.message;
          }
        }
      } else {
        errorMessage = String(err);
      }
      setError(errorMessage);
      setSubmitting(false);
      setCurrentStep('idle');
    }
  }

  const submitLabel = submitting
    ? currentStep === 'creating'
      ? 'Creating client…'
      : currentStep === 'uploading'
        ? 'Uploading KYC documents…'
        : 'Working…'
    : kycItems.length > 0
      ? `Create client & upload ${kycItems.length} document${kycItems.length === 1 ? '' : 's'}`
      : 'Create client';

  const savedUnchanged =
    savedInvoiceTo !== null && !customizeInvoiceTo && invoiceToEquals(invoiceTo, savedInvoiceTo);

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <button type="button" onClick={() => navigate(backPath)} disabled={submitting}>
          ← Back
        </button>
      </div>

      <h1>Create New Client</h1>
      <p style={{ marginTop: '-0.5rem', color: '#64748b', fontSize: '0.9rem' }}>
        Register the client, capture the booking details, confirm the Invoice-To entity, and
        upload KYC documents – all in one step. The client starts directly at the KYC stage; no
        payment step is required for aggregator-onboarded clients.
      </p>

      <form onSubmit={handleSubmit} style={{ maxWidth: '840px', marginTop: '1.5rem' }}>
        {/* Section 1: Client details */}
        <section
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
            background: '#fff',
          }}
        >
          <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem' }}>1. Client details</h2>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
            Core contact and company information for the client being onboarded.
          </p>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 500,
                fontSize: '0.9rem',
              }}
            >
              Client Channel
            </label>
            <div
              style={{
                padding: '0.6rem 0.75rem',
                borderRadius: 6,
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                fontSize: '0.9rem',
                color: '#0f172a',
              }}
            >
              Aggregator (skip payment, KYC first)
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label
                htmlFor="companyName"
                style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
              >
                Client Company Name <span style={{ color: 'crimson' }}>*</span>
              </label>
              <input
                id="companyName"
                name="companyName"
                type="text"
                value={formData.companyName}
                onChange={handleChange}
                className={inputClass}
                required
                disabled={submitting}
              />
            </div>
            <div>
              <label
                htmlFor="contactEmail"
                style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
              >
                Contact Email <span style={{ color: 'crimson' }}>*</span>
              </label>
              <input
                id="contactEmail"
                name="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={handleChange}
                className={inputClass}
                required
                disabled={submitting}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label
                htmlFor="contactPhone"
                style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
              >
                Contact Phone
              </label>
              <input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                value={formData.contactPhone}
                onChange={handleChange}
                className={inputClass}
                disabled={submitting}
              />
            </div>
            <div>
              <label
                htmlFor="taxId"
                style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
              >
                Tax ID
              </label>
              <input
                id="taxId"
                name="taxId"
                type="text"
                value={formData.taxId}
                onChange={handleChange}
                className={inputClass}
                disabled={submitting}
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label
              htmlFor="address"
              style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
            >
              Address
            </label>
            <input
              id="address"
              name="address"
              type="text"
              value={formData.address}
              onChange={handleChange}
              className={inputClass}
              disabled={submitting}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: '1rem',
              marginTop: '1rem',
            }}
          >
            <div>
              <label htmlFor="city" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
                City
              </label>
              <input
                id="city"
                name="city"
                type="text"
                value={formData.city}
                onChange={handleChange}
                className={inputClass}
                disabled={submitting}
              />
            </div>
            <div>
              <label htmlFor="state" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
                State
              </label>
              <input
                id="state"
                name="state"
                type="text"
                value={formData.state}
                onChange={handleChange}
                className={inputClass}
                disabled={submitting}
              />
            </div>
            <div>
              <label
                htmlFor="zipCode"
                style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
              >
                Zip Code
              </label>
              <input
                id="zipCode"
                name="zipCode"
                type="text"
                value={formData.zipCode}
                onChange={handleChange}
                className={inputClass}
                disabled={submitting}
              />
            </div>
            <div>
              <label
                htmlFor="country"
                style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
              >
                Country
              </label>
              <input
                id="country"
                name="country"
                type="text"
                value={formData.country}
                onChange={handleChange}
                className={inputClass}
                disabled={submitting}
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label htmlFor="notes" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className={inputClass}
              rows={3}
              disabled={submitting}
            />
          </div>
        </section>

        {/* Section 2: Booking details */}
        <section
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
            background: '#fff',
          }}
        >
          <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem' }}>2. Booking details</h2>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
            Booking reference, plan, venue and commercial terms. All fields are optional and can
            be updated later by Aspire admins.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label
                htmlFor="bookingReference"
                style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
              >
                Booking ID / Reference
              </label>
              <input
                id="bookingReference"
                name="bookingReference"
                type="text"
                value={booking.bookingReference}
                onChange={handleBookingChange}
                className={inputClass}
                placeholder="e.g. ISXVSBRKA1603"
                disabled={submitting}
              />
            </div>
            <div>
              <label
                htmlFor="planType"
                style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
              >
                Plan type
              </label>
              <input
                id="planType"
                name="planType"
                type="text"
                value={booking.planType}
                onChange={handleBookingChange}
                className={inputClass}
                placeholder="e.g. BR"
                list="plan-type-suggestions"
                disabled={submitting}
              />
              <datalist id="plan-type-suggestions">
                {PLAN_TYPE_SUGGESTIONS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label
              htmlFor="venueName"
              style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
            >
              Venue name
            </label>
            <input
              id="venueName"
              name="venueName"
              type="text"
              value={booking.venueName}
              onChange={handleBookingChange}
              className={inputClass}
              placeholder="e.g. Aspire Coworks Koramangala"
              disabled={submitting}
            />
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label
              htmlFor="venueAddress"
              style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
            >
              Venue address
            </label>
            <textarea
              id="venueAddress"
              name="venueAddress"
              value={booking.venueAddress}
              onChange={handleBookingChange}
              className={inputClass}
              rows={2}
              disabled={submitting}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '140px 160px 120px 1fr',
              gap: '1rem',
              marginTop: '1rem',
              alignItems: 'end',
            }}
          >
            <div>
              <label
                htmlFor="durationMonths"
                style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
              >
                Duration (months)
              </label>
              <input
                id="durationMonths"
                name="durationMonths"
                type="number"
                min={1}
                max={120}
                value={booking.durationMonths}
                onChange={handleBookingChange}
                className={inputClass}
                disabled={submitting}
              />
            </div>
            <div>
              <label
                htmlFor="amount"
                style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
              >
                Amount
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                min={0}
                step="0.01"
                value={booking.amount}
                onChange={handleBookingChange}
                className={inputClass}
                disabled={submitting}
              />
            </div>
            <div>
              <label
                htmlFor="currency"
                style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
              >
                Currency
              </label>
              <input
                id="currency"
                name="currency"
                type="text"
                maxLength={3}
                value={booking.currency}
                onChange={handleBookingChange}
                className={inputClass}
                style={{ textTransform: 'uppercase' }}
                disabled={submitting}
              />
            </div>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.9rem',
                color: '#334155',
                paddingBottom: '0.55rem',
              }}
            >
              <input
                type="checkbox"
                name="gstApplicable"
                checked={booking.gstApplicable}
                onChange={handleBookingChange}
                disabled={submitting}
              />
              GST applicable
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label
                htmlFor="paymentTerms"
                style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
              >
                Payment terms
              </label>
              <textarea
                id="paymentTerms"
                name="paymentTerms"
                value={booking.paymentTerms}
                onChange={handleBookingChange}
                className={inputClass}
                rows={3}
                disabled={submitting}
              />
            </div>
            <div>
              <label
                htmlFor="signageTerms"
                style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
              >
                Signage terms
              </label>
              <textarea
                id="signageTerms"
                name="signageTerms"
                value={booking.signageTerms}
                onChange={handleBookingChange}
                className={inputClass}
                rows={3}
                disabled={submitting}
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '1rem',
              marginTop: '1rem',
            }}
          >
            <div>
              <label
                htmlFor="clientContactName"
                style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
              >
                Client contact name
              </label>
              <input
                id="clientContactName"
                name="clientContactName"
                type="text"
                value={booking.clientContactName}
                onChange={handleBookingChange}
                className={inputClass}
                placeholder="Person at the client company"
                disabled={submitting}
              />
            </div>
            <div>
              <label
                htmlFor="pocName"
                style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
              >
                POC name (at your org)
              </label>
              <input
                id="pocName"
                name="pocName"
                type="text"
                value={booking.pocName}
                onChange={handleBookingChange}
                className={inputClass}
                disabled={submitting}
              />
            </div>
            <div>
              <label
                htmlFor="pocContact"
                style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
              >
                POC contact
              </label>
              <input
                id="pocContact"
                name="pocContact"
                type="text"
                value={booking.pocContact}
                onChange={handleBookingChange}
                className={inputClass}
                placeholder="Phone or email"
                disabled={submitting}
              />
            </div>
          </div>
        </section>

        {/* Section 3: Invoice To */}
        <section
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
            background: '#fff',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>3. Invoice To</h2>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                The legal entity invoices should be raised to for this booking.
              </p>
            </div>
            {savedUnchanged && (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.55rem',
                  background: '#ecfdf5',
                  color: '#065f46',
                  borderRadius: 999,
                  fontWeight: 600,
                  border: '1px solid #a7f3d0',
                }}
              >
                Using your saved invoicing details
              </span>
            )}
          </div>

          {profileLoading ? (
            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
              Loading your saved invoicing details…
            </p>
          ) : (
            <>
              {savedInvoiceTo && !customizeInvoiceTo ? (
                <div
                  style={{
                    marginTop: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    padding: '0.75rem 0.9rem',
                    background: '#f8fafc',
                    fontSize: '0.88rem',
                    color: '#0f172a',
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{savedInvoiceTo.legalName}</div>
                  {savedInvoiceTo.constitution && (
                    <div style={{ color: '#475569' }}>{savedInvoiceTo.constitution}</div>
                  )}
                  {(savedInvoiceTo.gstin || savedInvoiceTo.pan) && (
                    <div style={{ color: '#475569', marginTop: '0.25rem' }}>
                      {savedInvoiceTo.gstin && <>GSTIN: <strong>{savedInvoiceTo.gstin}</strong></>}
                      {savedInvoiceTo.gstin && savedInvoiceTo.pan && <span>{' · '}</span>}
                      {savedInvoiceTo.pan && <>PAN: <strong>{savedInvoiceTo.pan}</strong></>}
                    </div>
                  )}
                  {savedInvoiceTo.registeredAddress && (
                    <div style={{ color: '#475569', marginTop: '0.25rem', whiteSpace: 'pre-line' }}>
                      {savedInvoiceTo.registeredAddress}
                    </div>
                  )}
                  <div style={{ marginTop: '0.65rem', display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setCustomizeInvoiceTo(true)}
                      disabled={submitting}
                      style={{
                        fontSize: '0.82rem',
                        color: '#2563eb',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Customize for this booking
                    </button>
                    <Link
                      to="/aggregator/invoice-profile"
                      style={{
                        fontSize: '0.82rem',
                        color: '#64748b',
                        textDecoration: 'underline',
                      }}
                    >
                      Edit my saved profile
                    </Link>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '0.75rem' }}>
                  {!savedInvoiceTo && (
                    <div
                      style={{
                        marginBottom: '0.75rem',
                        padding: '0.55rem 0.75rem',
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        color: '#92400e',
                        borderRadius: 6,
                        fontSize: '0.83rem',
                      }}
                    >
                      You haven't saved an Invoice-To profile yet. Fill it in below – you can opt
                      to save it as the default for future bookings.
                    </div>
                  )}

                  <div style={{ marginBottom: '1rem' }}>
                    <label
                      htmlFor="legalName"
                      style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
                    >
                      Company legal name
                    </label>
                    <input
                      id="legalName"
                      name="legalName"
                      type="text"
                      value={invoiceTo.legalName}
                      onChange={handleInvoiceToChange}
                      className={inputClass}
                      placeholder="e.g. Instaspaces Realtech Private Limited"
                      disabled={submitting}
                    />
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label
                      htmlFor="constitution"
                      style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
                    >
                      Constitution
                    </label>
                    <input
                      id="constitution"
                      name="constitution"
                      type="text"
                      value={invoiceTo.constitution}
                      onChange={handleInvoiceToChange}
                      className={inputClass}
                      placeholder="e.g. Private Limited Company"
                      disabled={submitting}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label
                        htmlFor="gstin"
                        style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
                      >
                        GSTIN
                      </label>
                      <input
                        id="gstin"
                        name="gstin"
                        type="text"
                        value={invoiceTo.gstin}
                        onChange={handleInvoiceToChange}
                        className={inputClass}
                        placeholder="15-character GSTIN"
                        maxLength={15}
                        style={{ textTransform: 'uppercase' }}
                        disabled={submitting}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="pan"
                        style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
                      >
                        PAN
                      </label>
                      <input
                        id="pan"
                        name="pan"
                        type="text"
                        value={invoiceTo.pan}
                        onChange={handleInvoiceToChange}
                        className={inputClass}
                        placeholder="AAAAA9999A"
                        maxLength={10}
                        style={{ textTransform: 'uppercase' }}
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <label
                      htmlFor="registeredAddress"
                      style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}
                    >
                      Registered address
                    </label>
                    <textarea
                      id="registeredAddress"
                      name="registeredAddress"
                      value={invoiceTo.registeredAddress}
                      onChange={handleInvoiceToChange}
                      className={inputClass}
                      rows={3}
                      disabled={submitting}
                    />
                  </div>

                  <div
                    style={{
                      marginTop: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <label
                      style={{
                        display: 'inline-flex',
                        gap: '0.45rem',
                        alignItems: 'center',
                        fontSize: '0.85rem',
                        color: '#334155',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={saveInvoiceToProfile}
                        onChange={(e) => setSaveInvoiceToProfile(e.target.checked)}
                        disabled={submitting}
                      />
                      Save these details to my profile for future bookings
                    </label>
                    {savedInvoiceTo && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomizeInvoiceTo(false);
                          setInvoiceTo(toInvoiceToState(
                            // rehydrate: convert saved state to input shape
                            {
                              id: '',
                              userId: '',
                              legalName: savedInvoiceTo.legalName,
                              constitution: savedInvoiceTo.constitution ?? null,
                              gstin: savedInvoiceTo.gstin ?? null,
                              pan: savedInvoiceTo.pan ?? null,
                              registeredAddress: savedInvoiceTo.registeredAddress ?? null,
                              createdAt: '',
                              updatedAt: '',
                            } as AggregatorInvoiceProfile,
                          ));
                          setSaveInvoiceToProfile(false);
                        }}
                        disabled={submitting}
                        style={{
                          fontSize: '0.82rem',
                          color: '#64748b',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: submitting ? 'not-allowed' : 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Use my saved invoicing details
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Section 4: KYC documents */}
        <section
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
            background: '#fff',
          }}
        >
          <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem' }}>4. KYC documents</h2>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
            Attach the client's KYC documents (Aadhaar, PAN, or other supporting files). You can
            attach multiple files now, or skip this and upload later from the client detail page.
            Allowed formats: PDF, JPG, PNG. Max 10&nbsp;MB per file.
          </p>

          <div
            style={{
              border: '1px dashed #cbd5e1',
              borderRadius: 6,
              padding: '0.85rem',
              background: '#f8fafc',
              marginBottom: '0.75rem',
            }}
          >
            <label
              style={{
                display: 'inline-block',
                padding: '0.4rem 0.85rem',
                background: '#1d4ed8',
                color: '#fff',
                borderRadius: 4,
                fontSize: '0.85rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {kycItems.length === 0 ? 'Choose KYC files' : 'Add more files'}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={(e) => {
                  handleFilesSelected(e.target.files);
                  e.target.value = '';
                }}
                disabled={submitting}
                style={{ display: 'none' }}
              />
            </label>
            <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
              {kycItems.length === 0
                ? 'No files attached yet (optional).'
                : `${kycItems.length} file${kycItems.length === 1 ? '' : 's'} attached`}
            </span>
          </div>

          {kycItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {kycItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 160px 110px 30px',
                    gap: '0.5rem',
                    alignItems: 'center',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    padding: '0.5rem 0.75rem',
                    background:
                      item.status === 'error'
                        ? '#fef2f2'
                        : item.status === 'done'
                          ? '#f0fdf4'
                          : '#fff',
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <div
                      style={{
                        fontSize: '0.85rem',
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={item.file.name}
                    >
                      {item.file.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {(item.file.size / 1024).toFixed(1)} KB
                      {item.error ? ` · ${item.error}` : ''}
                    </div>
                  </div>
                  <select
                    value={item.documentType}
                    onChange={(e) =>
                      updateItem(item.id, { documentType: e.target.value as KycDocType })
                    }
                    disabled={submitting || item.status === 'done'}
                    style={{
                      padding: '0.35rem 0.5rem',
                      borderRadius: 4,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                    }}
                  >
                    {KYC_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      textAlign: 'center',
                      color:
                        item.status === 'done'
                          ? '#166534'
                          : item.status === 'error'
                            ? '#b91c1c'
                            : item.status === 'uploading'
                              ? '#1d4ed8'
                              : '#475569',
                    }}
                  >
                    {item.status === 'done'
                      ? 'Uploaded'
                      : item.status === 'error'
                        ? 'Failed'
                        : item.status === 'uploading'
                          ? 'Uploading…'
                          : 'Ready'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={submitting}
                    title="Remove"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#64748b',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      fontSize: '1rem',
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {error && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              backgroundColor: '#ffebee',
              color: 'crimson',
              borderRadius: 4,
            }}
          >
            <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Error:</div>
            <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {error}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitLabel}
          </button>
          <button
            type="button"
            onClick={() => navigate(backPath)}
            disabled={submitting}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
