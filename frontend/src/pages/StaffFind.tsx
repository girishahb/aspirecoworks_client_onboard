import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser } from '../services/auth';
import {
  canSeeMoney,
  fmtDate,
  lookupClients,
  StaffClientCard,
} from '../services/staffOps';

export default function StaffFind() {
  const user = getCurrentUser();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StaffClientCard[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function runLookup(e?: FormEvent) {
    e?.preventDefault();
    if (query.trim().length < 2) {
      setError('Enter at least 2 characters');
      return;
    }
    setBusy(true);
    setError(null);
    setSearched(true);
    try {
      const rows = await lookupClients(query.trim(), 30);
      setResults(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/staff" className="text-sm font-medium hover:underline" style={{ color: '#134b7f' }}>
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Find client</h1>
      </div>

      <form onSubmit={runLookup} className="flex flex-col gap-3 sm:flex-row">
        <input
          className="form-input flex-1"
          placeholder="Company, phone, booking ID, name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="btn-primary sm:w-auto" disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {results.map((item) => (
          <Link
            key={item.id}
            to={`/staff/clients/${item.id}`}
            className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#134b7f]/40"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">{item.companyName}</h2>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  item.isActive
                    ? 'bg-green-50 text-green-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {item.isActive ? 'ACTIVE' : item.operationalStatus || 'INACTIVE'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{item.contactPersonName || '—'}</p>
            <p className="text-sm text-slate-500">{item.address || '—'}</p>
            <p className="text-sm text-slate-500">
              {fmtDate(item.contractStartDate)} → {fmtDate(item.contractEndDate)}
            </p>
            {canSeeMoney(user?.role) && (
              <p className="mt-1 text-sm text-slate-500">
                {item.vendor?.name ? `Vendor: ${item.vendor.name}` : 'Vendor: —'}
                {item.applicableRate
                  ? ` · Rate: ₹${item.applicableRate.rateExclusive} (${item.applicableRate.membershipType})`
                  : item.rateCard?.length
                    ? ` · Rates: ${item.rateCard.map((r) => `${r.membershipType} ₹${r.rateExclusive}`).join(', ')}`
                    : ' · No rate card'}
              </p>
            )}
          </Link>
        ))}

        {searched && !busy && results.length === 0 && !error && (
          <p className="text-sm text-slate-500">No results</p>
        )}
        {!searched && <p className="text-sm text-slate-500">No results yet</p>}
      </div>
    </div>
  );
}
