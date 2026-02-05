import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyCompany, type CompanyProfile } from '../services/company';
import { getCurrentUser } from '../services/auth';
import { Mail, Phone, MapPin, Building2 } from 'lucide-react';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { dateStyle: 'long' });
}

export default function ClientProfile() {
  const user = getCurrentUser();
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyCompany();
      setCompany(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h1>Company Profile</h1>
        <p>Loading profile…</p>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div>
        <h1>Company Profile</h1>
        <p style={{ color: 'crimson' }}>{error || 'Profile not found'}</p>
      </div>
    );
  }

  const addressParts = [
    company.address,
    company.city,
    company.state,
    company.zipCode,
    company.country,
  ].filter(Boolean);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1>Company Profile</h1>
        <Link to="/dashboard" className="text-primary hover:text-accent">
          ← Back to Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Company Information */}
        <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Building2 className="h-5 w-5" />
            Company Information
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-muted">Company Name</dt>
              <dd className="mt-1 text-text">{company.companyName}</dd>
            </div>
            {company.taxId && (
              <div>
                <dt className="text-sm font-medium text-muted">Tax ID</dt>
                <dd className="mt-1 text-text">{company.taxId}</dd>
              </div>
            )}
            {addressParts.length > 0 && (
              <div>
                <dt className="text-sm font-medium text-muted">Address</dt>
                <dd className="mt-1 flex items-start gap-2 text-text">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  <span>{addressParts.join(', ')}</span>
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* Contact Information */}
        <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Mail className="h-5 w-5" />
            Contact Information
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-muted">Contact Email</dt>
              <dd className="mt-1 flex items-center gap-2 text-text">
                <Mail className="h-4 w-4 text-muted" />
                <a href={`mailto:${company.contactEmail}`} className="text-primary hover:text-accent">
                  {company.contactEmail}
                </a>
              </dd>
            </div>
            {company.contactPhone && (
              <div>
                <dt className="text-sm font-medium text-muted">Contact Phone</dt>
                <dd className="mt-1 flex items-center gap-2 text-text">
                  <Phone className="h-4 w-4 text-muted" />
                  <a href={`tel:${company.contactPhone}`} className="text-primary hover:text-accent">
                    {company.contactPhone}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* Account Status */}
        <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Account Status</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-muted">Onboarding Stage</dt>
              <dd className="mt-1 text-text">{company.onboardingStage || '—'}</dd>
            </div>
            {company.activationDate && (
              <div>
                <dt className="text-sm font-medium text-muted">Activation Date</dt>
                <dd className="mt-1 text-text">{formatDate(company.activationDate as string)}</dd>
              </div>
            )}
            {company.renewalDate && (
              <div>
                <dt className="text-sm font-medium text-muted">Renewal Date</dt>
                <dd className="mt-1 text-text">{formatDate(company.renewalDate)}</dd>
              </div>
            )}
            {company.renewalStatus && (
              <div>
                <dt className="text-sm font-medium text-muted">Renewal Status</dt>
                <dd className="mt-1 text-text">{company.renewalStatus}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Support Information */}
        <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Support</h2>
          <div className="space-y-3">
            <p className="text-sm text-muted">
              For assistance with your account, please contact Aspire Coworks support.
            </p>
            <div>
              <p className="text-sm font-medium text-muted">Support Email</p>
              <a
                href="mailto:support@aspirecoworks.com"
                className="mt-1 text-primary hover:text-accent"
              >
                support@aspirecoworks.com
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
