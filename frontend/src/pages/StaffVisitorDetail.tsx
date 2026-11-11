import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { getCurrentUser } from '../services/auth';
import {
  canManageVisitors,
  checkoutVisitor,
  fetchVisitorMediaObjectUrl,
  getVisitor,
  type VisitorDetail,
} from '../services/visitors';

type NavState = {
  justCheckedIn?: boolean;
  hostEmailAttempted?: boolean;
  hostEmailSent?: boolean;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN');
}

export default function StaffVisitorDetail() {
  const { id } = useParams<{ id: string }>();
  const role = getCurrentUser()?.role;
  const location = useLocation();
  const navState = (location.state || {}) as NavState;

  const [visit, setVisit] = useState<VisitorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faceUrl, setFaceUrl] = useState<string | null>(null);
  const [sigUrl, setSigUrl] = useState<string | null>(null);
  const [aadhaarUrl, setAadhaarUrl] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const objectUrls: string[] = [];

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getVisitor(id!);
        if (cancelled) return;
        setVisit(data);

        if (data.hasFacePhoto) {
          const url = await fetchVisitorMediaObjectUrl(id!, 'face');
          objectUrls.push(url);
          if (!cancelled) setFaceUrl(url);
        }
        if (data.hasSignature) {
          const url = await fetchVisitorMediaObjectUrl(id!, 'signature');
          objectUrls.push(url);
          if (!cancelled) setSigUrl(url);
        }
        if (data.hasAadhaarPhoto) {
          const url = await fetchVisitorMediaObjectUrl(id!, 'aadhaar');
          objectUrls.push(url);
          if (!cancelled) setAadhaarUrl(url);
        }
      } catch (err) {
        if (!cancelled) {
          setVisit(null);
          setError(err instanceof Error ? err.message : 'Failed to load visit');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [id]);

  async function onCheckout() {
    if (!id) return;
    setCheckingOut(true);
    setError(null);
    try {
      const updated = await checkoutVisitor(id);
      setVisit(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  }

  if (!canManageVisitors(role)) {
    return <Navigate to="/staff" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/staff/visitors" className="text-sm font-medium hover:underline" style={{ color: '#134b7f' }}>
          ← Today’s visitors
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          {visit?.name || 'Visitor detail'}
        </h1>
      </div>

      {navState.justCheckedIn && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-semibold">Checked in successfully</p>
          <p className="mt-1">
            {navState.hostEmailAttempted
              ? navState.hostEmailSent
                ? 'Host email notification was sent.'
                : 'Host email was attempted but not sent (check Resend / logs).'
              : 'No host email provided — notification skipped.'}
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !visit ? (
        <p className="text-sm text-slate-500">Visit not found.</p>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <dl className="grid flex-1 gap-3 sm:grid-cols-2 text-sm">
                <Item label="Status" value={visit.status === 'CHECKED_IN' ? 'On site' : 'Checked out'} />
                <Item label="Phone" value={visit.phone} />
                <Item label="Email" value={visit.email || '—'} />
                <Item label="Company" value={visit.company || '—'} />
                <Item label="Purpose" value={visit.purpose} />
                <Item label="Location" value={visit.location?.name || '—'} />
                <Item label="Host" value={visit.hostName || visit.hostEmail || '—'} />
                <Item label="Host email" value={visit.hostEmail || '—'} />
                <Item label="Checked in" value={formatWhen(visit.checkInAt)} />
                <Item label="Checked out" value={formatWhen(visit.checkOutAt)} />
                <Item
                  label="Aadhaar"
                  value={
                    visit.aadhaarConsent
                      ? `Consented (${visit.aadhaarConsentVersion || '—'}) · ${visit.aadhaarLast4 || visit.aadhaarLast4Masked || '—'}`
                      : 'Not collected'
                  }
                />
                <Item
                  label="Host notify"
                  value={
                    visit.hostEmail
                      ? visit.hostEmailSent
                        ? 'Sent'
                        : visit.hostEmailError || 'Not sent'
                      : 'Skipped'
                  }
                />
              </dl>
              {visit.status === 'CHECKED_IN' && (
                <button
                  type="button"
                  disabled={checkingOut}
                  onClick={() => void onCheckout()}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: '#134b7f' }}
                >
                  {checkingOut ? 'Checking out…' : 'Check out'}
                </button>
              )}
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <MediaCard title="Face photo" url={faceUrl} />
            <MediaCard title="Signature" url={sigUrl} />
            {visit.hasAadhaarPhoto && <MediaCard title="Aadhaar card" url={aadhaarUrl} />}
          </section>
        </>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function MediaCard({ title, url }: { title: string; url: string | null }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {url ? (
        <img src={url} alt={title} className="mt-3 max-h-64 w-full rounded-lg object-contain bg-slate-50" />
      ) : (
        <p className="mt-3 text-sm text-slate-500">Not available</p>
      )}
    </div>
  );
}
