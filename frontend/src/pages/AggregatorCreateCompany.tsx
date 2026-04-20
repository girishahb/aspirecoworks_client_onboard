import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCompany } from '../services/admin';
import { uploadAggregatorKyc } from '../services/documents';

const inputClass =
  'block w-full max-w-md rounded-md border border-border bg-white px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60';

type KycDocType = 'AADHAAR' | 'PAN' | 'OTHER';

const KYC_TYPE_OPTIONS: { value: KycDocType; label: string }[] = [
  { value: 'AADHAAR', label: 'Aadhaar' },
  { value: 'PAN', label: 'PAN' },
  { value: 'OTHER', label: 'Other' },
];

type KycItemStatus = 'pending' | 'uploading' | 'done' | 'error';

interface KycItem {
  id: string;
  file: File;
  documentType: KycDocType;
  status: KycItemStatus;
  error?: string;
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

  const [kycItems, setKycItems] = useState<KycItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'idle' | 'creating' | 'uploading' | 'done'>('idle');

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
      const data: Record<string, string> = {
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

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <button type="button" onClick={() => navigate(backPath)} disabled={submitting}>
          ← Back
        </button>
      </div>

      <h1>Create New Client</h1>
      <p style={{ marginTop: '-0.5rem', color: '#64748b', fontSize: '0.9rem' }}>
        Register the client and upload their KYC documents in a single step. The client is created
        directly at the KYC stage – no payment step is required for aggregator-onboarded clients.
      </p>

      <form onSubmit={handleSubmit} style={{ maxWidth: '720px', marginTop: '1.5rem' }}>
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
            Core contact and company information.
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

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="companyName" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Company Name <span style={{ color: 'crimson' }}>*</span>
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

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="contactEmail" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
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

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="contactPhone" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
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

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="taxId" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
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

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="address" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label htmlFor="city" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
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
              <label htmlFor="state" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label htmlFor="zipCode" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
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
              <label htmlFor="country" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
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

          <div style={{ marginBottom: '0.25rem' }}>
            <label htmlFor="notes" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
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

        <section
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
            background: '#fff',
          }}
        >
          <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem' }}>2. KYC documents</h2>
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
                    background: item.status === 'error' ? '#fef2f2' : item.status === 'done' ? '#f0fdf4' : '#fff',
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
