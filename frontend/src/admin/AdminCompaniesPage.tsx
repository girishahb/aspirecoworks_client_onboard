import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api/client';
import type { AdminCompany, ComplianceStatus } from '../api/types';

function formatRenewalDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusLabel(onboardingStatus: string): string {
  return onboardingStatus === 'COMPLETED' ? 'Active' : 'Inactive';
}

function complianceLabel(isCompliant: boolean): string {
  return isCompliant ? 'Compliant' : 'Missing docs';
}

export function AdminCompaniesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [complianceByCompanyId, setComplianceByCompanyId] = useState<
    Record<string, ComplianceStatus>
  >({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const list = await apiGet<AdminCompany[]>('/companies');
        if (cancelled) return;

        const companyList = Array.isArray(list) ? list : [];
        setCompanies(companyList);

        const complianceMap: Record<string, ComplianceStatus> = {};
        await Promise.all(
          companyList.map(async (c) => {
            try {
              const comp = await apiGet<ComplianceStatus>(
                `/compliance/company/${c.id}`,
              );
              if (!cancelled) complianceMap[c.id] = comp;
            } catch {
              if (!cancelled) complianceMap[c.id] = { isCompliant: false } as ComplianceStatus;
            }
          }),
        );
        if (!cancelled) setComplianceByCompanyId(complianceMap);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load companies');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <p className="text-stone-500">Loading companies…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Link to="/admin/companies" className="mt-4 inline-block text-stone-600 underline">
            Try again
          </Link>
        </div>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 p-6">
        <div className="mx-auto max-w-4xl">
          <Link
            to="/"
            className="text-sm text-stone-600 hover:text-stone-900"
          >
            ← Back
          </Link>
          <div className="mt-6 rounded-xl border border-stone-200 bg-white p-12 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-stone-900">
              Companies
            </h1>
            <p className="mt-2 text-stone-500">No companies yet.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/"
          className="text-sm text-stone-600 hover:text-stone-900"
        >
          ← Back
        </Link>

        <h1 className="mt-6 text-2xl font-semibold text-stone-900">
          Companies
        </h1>

        <div className="mt-4 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full min-w-[600px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="px-4 py-3 font-medium text-stone-700">
                  Company name
                </th>
                <th className="px-4 py-3 font-medium text-stone-700">
                  Status
                </th>
                <th className="px-4 py-3 font-medium text-stone-700">
                  Renewal date
                </th>
                <th className="px-4 py-3 font-medium text-stone-700">
                  Compliance
                </th>
                <th className="px-4 py-3 font-medium text-stone-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => {
                const compliance = complianceByCompanyId[company.id];
                const isCompliant = compliance?.isCompliant ?? false;
                return (
                  <tr
                    key={company.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50"
                  >
                    <td className="px-4 py-3 font-medium text-stone-900">
                      {company.companyName}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {statusLabel(company.onboardingStatus)}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {formatRenewalDate(company.renewalDate)}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {complianceLabel(isCompliant)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/companies/${company.id}/documents`}
                        className="inline-block rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800"
                      >
                        Review Documents
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
