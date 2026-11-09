import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  LEAD_SOURCE_OPTIONS,
  MEMBERSHIP_TYPE_OPTIONS,
  OFFICE_TYPE_OPTIONS,
  OPERATIONAL_STATUS_OPTIONS,
} from '../constants/clientOpsOptions';
import { getCurrentUser } from '../services/auth';
import {
  canWriteClients,
  createClient,
  listLocations,
  listVendors,
  MetaLocation,
  MetaVendor,
} from '../services/staffOps';

const EMPTY = {
  companyName: '',
  contactPersonName: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
  membershipType: '',
  officeType: 'Virtual',
  leadSource: 'Aggregator',
  contractMonths: '',
  locationId: '',
  vendorId: '',
  contractStartDate: '',
  contractEndDate: '',
  operationalStatus: 'UNKNOWN',
  externalBookingId: '',
  notes: '',
};

export default function StaffNewClient() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const allowed = canWriteClients(user?.role);

  const [form, setForm] = useState({ ...EMPTY });
  const [locations, setLocations] = useState<MetaLocation[]>([]);
  const [vendors, setVendors] = useState<MetaVendor[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      setLoadingMeta(true);
      try {
        const locs = await listLocations();
        setLocations(locs);
        if (locs[0]) {
          setForm((f) => ({ ...f, locationId: locs[0].id }));
          const vs = await listVendors(locs[0].id);
          setVendors(vs);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load locations');
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, [allowed]);

  if (!allowed) {
    return <Navigate to="/staff" replace />;
  }

  async function onLocationChange(locationId: string) {
    setForm((f) => ({ ...f, locationId, vendorId: '' }));
    try {
      setVendors(await listVendors(locationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vendors');
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.companyName.trim() || !form.locationId) {
      setError('Company name and location are required');
      return;
    }
    const email = form.contactEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid contact email');
      return;
    }
    const bookingId = form.externalBookingId.trim();
    if (!bookingId) {
      setError('Booking ID is required for onboarding');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const body: Parameters<typeof createClient>[0] = {
        companyName: form.companyName.trim(),
        contactEmail: email,
        locationId: form.locationId,
        operationalStatus: form.operationalStatus,
        externalBookingId: bookingId,
      };
      if (form.contactPersonName.trim()) body.contactPersonName = form.contactPersonName.trim();
      if (form.contactPhone.trim()) body.contactPhone = form.contactPhone.trim();
      if (form.address.trim()) body.address = form.address.trim();
      if (form.membershipType.trim()) body.membershipType = form.membershipType.trim();
      if (form.officeType.trim()) body.officeType = form.officeType.trim();
      if (form.leadSource.trim()) body.leadSource = form.leadSource.trim();
      if (form.notes.trim()) body.notes = form.notes.trim();
      if (form.vendorId) body.vendorId = form.vendorId;
      if (form.contractStartDate.trim()) body.contractStartDate = form.contractStartDate.trim();
      if (form.contractEndDate.trim()) body.contractEndDate = form.contractEndDate.trim();
      if (form.contractMonths.trim()) {
        const n = Number(form.contractMonths);
        if (!Number.isFinite(n) || n <= 0) {
          setError('Enter a positive number of months');
          setBusy(false);
          return;
        }
        body.contractMonths = Math.round(n);
      }

      const created = await createClient(body);
      navigate(`/staff/clients/${created.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  function set<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/staff" className="text-sm font-medium hover:underline" style={{ color: '#134b7f' }}>
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">New client</h1>
      </div>

      {loadingMeta ? (
        <p className="text-sm text-slate-500">Loading locations…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Onboarding
            </h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Booking ID *</label>
              <input
                className="form-input"
                value={form.externalBookingId}
                onChange={(e) => set('externalBookingId', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
              <textarea
                className="form-input min-h-[88px]"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Company</h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Company name *</label>
              <input
                className="form-input"
                value={form.companyName}
                onChange={(e) => set('companyName', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Contact person</label>
              <input
                className="form-input"
                value={form.contactPersonName}
                onChange={(e) => set('contactPersonName', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Contact email *</label>
              <input
                type="email"
                className="form-input"
                value={form.contactEmail}
                onChange={(e) => set('contactEmail', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
              <input
                className="form-input"
                value={form.contactPhone}
                onChange={(e) => set('contactPhone', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
              <input
                className="form-input"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Branch</h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Location *</label>
              <select
                className="form-input"
                value={form.locationId}
                onChange={(e) => onLocationChange(e.target.value)}
                required
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code || ''} — {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Vendor</label>
              <select
                className="form-input"
                value={form.vendorId}
                onChange={(e) => set('vendorId', e.target.value)}
              >
                <option value="">(none)</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Plan</h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Office type</label>
              <select
                className="form-input"
                value={form.officeType}
                onChange={(e) => set('officeType', e.target.value)}
              >
                {OFFICE_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Lead source</label>
              <select
                className="form-input"
                value={form.leadSource}
                onChange={(e) => set('leadSource', e.target.value)}
              >
                {LEAD_SOURCE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Membership type</label>
              <select
                className="form-input"
                value={form.membershipType}
                onChange={(e) => set('membershipType', e.target.value)}
              >
                <option value="">(none)</option>
                {MEMBERSHIP_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Contract months</label>
              <input
                className="form-input"
                inputMode="numeric"
                value={form.contractMonths}
                onChange={(e) => set('contractMonths', e.target.value.replace(/[^\d]/g, ''))}
                placeholder="e.g. 12"
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Agreement
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Start date</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.contractStartDate}
                  onChange={(e) => set('contractStartDate', e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">End date</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.contractEndDate}
                  onChange={(e) => set('contractEndDate', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select
                className="form-input"
                value={form.operationalStatus}
                onChange={(e) => set('operationalStatus', e.target.value)}
              >
                {OPERATIONAL_STATUS_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o === 'UNKNOWN' ? 'Unknown' : o.charAt(0) + o.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Create client'}
          </button>
        </form>
      )}
    </div>
  );
}
