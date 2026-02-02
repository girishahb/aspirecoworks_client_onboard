import { useState, useEffect } from 'react';
import { apiGet } from '../api/client';
import type { CompanyMe } from '../api/types';
import type { DocumentListItem } from '../api/types';

function companyStatusDisplay(company: CompanyMe): string {
  if (company.renewalStatus === 'ACTIVE') return 'ACTIVE';
  if (company.renewalStatus === 'EXPIRED') return 'EXPIRED';
  return company.onboardingStatus ?? 'PENDING';
}

function documentStatusLabel(status: string): string {
  if (status === 'VERIFIED') return 'Approved';
  return status;
}

export default function Status() {
  const companyId =
    typeof window !== 'undefined' ? localStorage.getItem('companyId') : null;
  const [company, setCompany] = useState<CompanyMe | null>(null);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const [companyRes, docsRes] = await Promise.all([
          apiGet<CompanyMe>('/companies/me'),
          apiGet<DocumentListItem[]>('/documents'),
        ]);
        if (!cancelled) {
          setCompany(companyRes);
          setDocuments(Array.isArray(docsRes) ? docsRes : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load status');
          setCompany(null);
          setDocuments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (loading) {
    return (
      <div>
        <h1>Onboarding status</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1>Onboarding status</h1>
        <p style={{ color: 'crimson' }}>{error}</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div>
        <h1>Onboarding status</h1>
        <p>No company data. Complete onboarding and sign in with a company account.</p>
      </div>
    );
  }

  const status = companyStatusDisplay(company);
  const isActive = company.renewalStatus === 'ACTIVE';

  return (
    <div>
      <h1>Onboarding status</h1>

      {companyId && (
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
          Company ID: {companyId}
        </p>
      )}

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Company</h2>
        <p><strong>Name:</strong> {company.companyName}</p>
        <p><strong>Company status:</strong> {status}</p>
        {company.renewalDate && (
          <p><strong>Renewal date:</strong> {new Date(company.renewalDate).toLocaleDateString()}</p>
        )}
      </section>

      {isActive && (
        <p style={{ marginBottom: '1.5rem', padding: '0.75rem', background: '#e8f5e9' }}>
          Access enabled – welcome to Aspire Coworks
        </p>
      )}

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Uploaded documents</h2>
        {documents.length === 0 ? (
          <p style={{ color: '#666' }}>No documents uploaded yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {documents.map((doc) => (
              <li
                key={doc.id}
                style={{
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #eee',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <span>{doc.fileName}</span>
                <span style={{ fontWeight: 500 }}>
                  {documentStatusLabel(doc.status)}
                  {doc.rejectionReason && (
                    <span style={{ color: '#666', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                      — {doc.rejectionReason}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
