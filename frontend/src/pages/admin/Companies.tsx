import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../api/client';
import type { AdminCompany } from '../../api/types';

export default function Companies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const list = await apiGet<AdminCompany[]>('/companies');
        if (!cancelled) {
          const pending = Array.isArray(list)
            ? list.filter((c) => c.onboardingStatus === 'PENDING')
            : [];
          setCompanies(pending);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load companies');
          setCompanies([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
  }

  if (loading) {
    return (
      <div>
        <h1>Admin – Companies</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1>Admin – Companies</h1>
        <p style={{ color: 'crimson' }}>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Admin – Companies</h1>
      <p style={{ marginBottom: '1rem', color: '#666' }}>
        Companies with status PENDING
      </p>
      {companies.length === 0 ? (
        <p>No pending companies.</p>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: '40rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem 0.75rem' }}>Company name</th>
              <th style={{ padding: '0.5rem 0.75rem' }}>Contact email</th>
              <th style={{ padding: '0.5rem 0.75rem' }}>Created date</th>
              <th style={{ padding: '0.5rem 0.75rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '0.5rem 0.75rem' }}>{c.companyName}</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{c.contactEmail}</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{formatDate(c.createdAt)}</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/companies/${c.id}`)}
                    style={{ padding: '0.35rem 0.6rem' }}
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
