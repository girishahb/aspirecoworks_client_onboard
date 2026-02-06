import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCompany } from '../services/admin';

const inputClass =
  'block w-full max-w-md rounded-md border border-border bg-white px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60';

export default function AdminCreateCompany() {
  const navigate = useNavigate();
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data: any = {
        companyName: formData.companyName.trim(),
        contactEmail: formData.contactEmail.trim(),
      };

      // Add optional fields only if they have values
      if (formData.contactPhone.trim()) data.contactPhone = formData.contactPhone.trim();
      if (formData.taxId.trim()) data.taxId = formData.taxId.trim();
      if (formData.address.trim()) data.address = formData.address.trim();
      if (formData.city.trim()) data.city = formData.city.trim();
      if (formData.state.trim()) data.state = formData.state.trim();
      if (formData.zipCode.trim()) data.zipCode = formData.zipCode.trim();
      if (formData.country.trim()) data.country = formData.country.trim();
      if (formData.notes.trim()) data.notes = formData.notes.trim();

      console.log('Submitting company data:', data);
      const company = await createCompany(data);
      navigate(`/admin/companies/${company.id}`, { replace: true });
    } catch (err: any) {
      // Extract error message - it should already include details from apiPost
      let errorMessage = 'Failed to create company';
      if (err instanceof Error) {
        errorMessage = err.message;
        // Log the full error for debugging
        console.error('Create company error:', err);
        console.error('Error response:', (err as any).response);
        console.error('Full error object:', err);
        
        // If message is just "Validation failed", try to extract more details
        if (errorMessage === 'Validation failed' && (err as any).response) {
          const response = (err as any).response;
          if (response.errors && Array.isArray(response.errors)) {
            const details = response.errors
              .map((e: any) => `${e.path || 'field'}: ${e.message || e}`)
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
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <button type="button" onClick={() => navigate('/admin/dashboard')}>
          ← Back to dashboard
        </button>
      </div>

      <h1>Create New Client</h1>

      <form onSubmit={handleSubmit} style={{ maxWidth: '600px', marginTop: '1.5rem' }}>
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
            disabled={loading}
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
            disabled={loading}
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
            disabled={loading}
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
            disabled={loading}
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
            disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="notes" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            className={inputClass}
            rows={4}
            disabled={loading}
          />
        </div>

        {error && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#ffebee', color: 'crimson', borderRadius: 4 }}>
            <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Error:</div>
            <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{error}</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.8 }}>
              Check the browser console for more details.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Creating...' : 'Create Company'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/dashboard')}
            disabled={loading}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
