import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../api/client';

interface CreateCompanyResponse {
  id: string;
  companyName: string;
  contactEmail: string;
  taxId?: string | null;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiPost<CreateCompanyResponse>('/companies', {
        companyName: companyName.trim(),
        contactEmail: contactEmail.trim(),
        taxId: gstNumber.trim() || undefined,
      });
      if (res?.id) {
        localStorage.setItem('companyId', res.id);
        navigate('/upload-documents');
      } else {
        setError('Unexpected response');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Request failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Company onboarding</h1>
      <form onSubmit={handleSubmit} style={{ marginTop: '1rem', maxWidth: '20rem' }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="companyName" style={{ display: 'block', marginBottom: '0.25rem' }}>
            Company Name
          </label>
          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            style={{ width: '100%', padding: '0.35rem' }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="gstNumber" style={{ display: 'block', marginBottom: '0.25rem' }}>
            GST Number
          </label>
          <input
            id="gstNumber"
            type="text"
            value={gstNumber}
            onChange={(e) => setGstNumber(e.target.value)}
            style={{ width: '100%', padding: '0.35rem' }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="contactEmail" style={{ display: 'block', marginBottom: '0.25rem' }}>
            Contact Email
          </label>
          <input
            id="contactEmail"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            style={{ width: '100%', padding: '0.35rem' }}
          />
        </div>
        {error && (
          <p style={{ color: 'crimson', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting} style={{ padding: '0.4rem 0.75rem' }}>
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </form>
    </div>
  );
}
