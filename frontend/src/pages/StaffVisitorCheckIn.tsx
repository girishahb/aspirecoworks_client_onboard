import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../services/auth';
import { listLocations, type MetaLocation } from '../services/staffOps';
import {
  canManageVisitors,
  checkInVisitor,
  getVisitorConsentMeta,
  type VisitorConsentMeta,
} from '../services/visitors';
import WebcamCapture from '../components/visitors/WebcamCapture';
import SignaturePad from '../components/visitors/SignaturePad';
import AadhaarOptional from '../components/visitors/AadhaarOptional';

const STEPS = ['Details', 'Photo', 'Signature', 'Aadhaar', 'Confirm'] as const;

function dataUrlToPayload(dataUrl: string): { imageBase64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' } {
  const mimeMatch = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,/);
  const mime = (mimeMatch?.[1] || 'image/jpeg').toLowerCase();
  const mimeType =
    mime.includes('png') ? 'image/png' : mime.includes('webp') ? 'image/webp' : 'image/jpeg';
  return { imageBase64: dataUrl, mimeType };
}

export default function StaffVisitorCheckIn() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const role = user?.role;

  const [step, setStep] = useState(0);
  const [locations, setLocations] = useState<MetaLocation[]>([]);
  const [consentMeta, setConsentMeta] = useState<VisitorConsentMeta | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [purpose, setPurpose] = useState('');
  const [hostName, setHostName] = useState('');
  const [hostEmail, setHostEmail] = useState('');
  const [locationId, setLocationId] = useState('');

  const [facePhoto, setFacePhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const [aadhaarConsent, setAadhaarConsent] = useState(false);
  const [aadhaarLast4, setAadhaarLast4] = useState('');
  const [aadhaarPhoto, setAadhaarPhoto] = useState<string | null>(null);

  useEffect(() => {
    listLocations()
      .then((rows) => {
        setLocations(rows);
        if (rows.length === 1) setLocationId(rows[0].id);
      })
      .catch(() => setLocations([]));
    getVisitorConsentMeta()
      .then(setConsentMeta)
      .catch(() =>
        setConsentMeta({
          version: 'v1-2026-03',
          text:
            'I consent to Aspire Coworks recording the last 4 digits of my Aadhaar number for visitor verification. The full Aadhaar number will not be stored.',
          retentionDays: 90,
        }),
      );
  }, []);

  if (!canManageVisitors(role)) {
    return <Navigate to="/staff" replace />;
  }

  function validateDetails(): string | null {
    if (!name.trim()) return 'Visitor name is required';
    if (!phone.trim()) return 'Phone is required';
    if (!purpose.trim()) return 'Purpose is required';
    if (hostEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hostEmail.trim())) {
      return 'Host email looks invalid';
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Visitor email looks invalid';
    }
    return null;
  }

  function canGoNext(): boolean {
    if (step === 0) return !validateDetails();
    if (step === 1) return !!facePhoto;
    if (step === 2) return !!signature;
    if (step === 3) {
      if (!aadhaarConsent) return true;
      return /^\d{4}$/.test(aadhaarLast4);
    }
    return true;
  }

  function next() {
    setError(null);
    if (step === 0) {
      const err = validateDetails();
      if (err) {
        setError(err);
        return;
      }
    }
    if (!canGoNext()) {
      setError('Complete this step before continuing');
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    setError(null);
    if (!facePhoto || !signature) {
      setError('Face photo and signature are required');
      return;
    }
    if (aadhaarConsent && !/^\d{4}$/.test(aadhaarLast4)) {
      setError('Enter exactly 4 Aadhaar digits when consent is given');
      return;
    }
    setSubmitting(true);
    try {
      const result = await checkInVisitor({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        company: company.trim() || undefined,
        purpose: purpose.trim(),
        hostName: hostName.trim() || undefined,
        hostEmail: hostEmail.trim() || undefined,
        locationId: locationId || undefined,
        facePhoto: dataUrlToPayload(facePhoto),
        signature: dataUrlToPayload(signature),
        aadhaarConsent,
        aadhaarLast4: aadhaarConsent ? aadhaarLast4 : undefined,
        aadhaarPhoto:
          aadhaarConsent && aadhaarPhoto ? dataUrlToPayload(aadhaarPhoto) : undefined,
        aadhaarConsentVersion: consentMeta?.version,
      });
      navigate(`/staff/visitors/${result.id}`, {
        replace: true,
        state: {
          justCheckedIn: true,
          hostEmailAttempted: result.hostEmailAttempted,
          hostEmailSent: result.hostEmailSent,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/staff/visitors" className="text-sm font-medium hover:underline" style={{ color: '#134b7f' }}>
            ← Today’s visitors
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Visitor check-in</h1>
          <p className="text-sm text-slate-500">Staff reception flow · host is optional for walk-ins / customers</p>
        </div>
      </div>

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              i === step
                ? 'text-white'
                : i < step
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-500'
            }`}
            style={i === step ? { background: '#134b7f' } : undefined}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Visitor name *" value={name} onChange={setName} />
            <Field label="Phone *" value={phone} onChange={setPhone} />
            <Field label="Email (optional)" value={email} onChange={setEmail} />
            <Field label="Company (optional)" value={company} onChange={setCompany} />
            <div className="sm:col-span-2">
              <Field label="Purpose *" value={purpose} onChange={setPurpose} />
            </div>
            <Field
              label="Host name (optional)"
              value={hostName}
              onChange={setHostName}
              hint="Leave blank for walk-in / existing customer"
            />
            <Field label="Host email (optional)" value={hostEmail} onChange={setHostEmail} />
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Location
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">— Select —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.code ? ` (${l.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 1 && (
          <WebcamCapture value={facePhoto} onCapture={setFacePhoto} onClear={() => setFacePhoto(null)} />
        )}

        {step === 2 && <SignaturePad value={signature} onChange={setSignature} />}

        {step === 3 && consentMeta && (
          <AadhaarOptional
            consentText={consentMeta.text}
            consentVersion={consentMeta.version}
            consented={aadhaarConsent}
            onConsentChange={setAadhaarConsent}
            last4={aadhaarLast4}
            onLast4Change={setAadhaarLast4}
            cardPhoto={aadhaarPhoto}
            onCardPhoto={setAadhaarPhoto}
          />
        )}

        {step === 4 && (
          <div className="space-y-4 text-sm text-slate-700">
            <dl className="grid gap-2 sm:grid-cols-2">
              <Row label="Name" value={name} />
              <Row label="Phone" value={phone} />
              <Row label="Email" value={email || '—'} />
              <Row label="Company" value={company || '—'} />
              <Row label="Purpose" value={purpose} />
              <Row label="Host" value={hostName || hostEmail ? `${hostName || '—'} / ${hostEmail || '—'}` : 'None (no email)'} />
              <Row
                label="Location"
                value={locations.find((l) => l.id === locationId)?.name || '—'}
              />
              <Row
                label="Aadhaar"
                value={
                  aadhaarConsent
                    ? `Consented · ****${aadhaarLast4}${aadhaarPhoto ? ' · card photo' : ''}`
                    : 'Skipped'
                }
              />
            </dl>
            <div className="grid gap-3 sm:grid-cols-2">
              {facePhoto && (
                <img src={facePhoto} alt="Face" className="rounded-xl border border-slate-200 max-h-48 object-contain bg-slate-50" />
              )}
              {signature && (
                <img src={signature} alt="Signature" className="rounded-xl border border-slate-200 max-h-48 object-contain bg-white" />
              )}
            </div>
            <p className="text-xs text-slate-500">
              Host email is sent only when a host email is provided. Retention recommendation:{' '}
              {consentMeta?.retentionDays ?? 90} days.
            </p>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep((s) => s - 1);
            }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={next}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: '#134b7f' }}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: '#134b7f' }}
          >
            {submitting ? 'Checking in…' : 'Confirm check-in'}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{value}</dd>
    </div>
  );
}
