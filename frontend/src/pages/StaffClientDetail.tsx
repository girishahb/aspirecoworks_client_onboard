import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCurrentUser } from '../services/auth';
import {
  canNotifyMail,
  canSeeMoney,
  canWriteClients,
  fileToBase64,
  fmtDate,
  getClientStatus,
  notifyMailReceived,
  StaffClientCard,
  updateClient,
} from '../services/staffOps';

function DetailRow({ label, value }: { label: string; value?: string | number | null | boolean }) {
  if (value === null || value === undefined || value === '') return null;
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  return (
    <div className="py-2 border-b border-slate-100 last:border-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{display}</dd>
    </div>
  );
}

export default function StaffClientDetail() {
  const { id = '' } = useParams();
  const user = getCurrentUser();
  const role = user?.role;

  const [selected, setSelected] = useState<StaffClientCard | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ externalBookingId: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const [mailPreview, setMailPreview] = useState<string | null>(null);
  const [mailBase64, setMailBase64] = useState<string | null>(null);
  const [mailMime, setMailMime] = useState('image/jpeg');
  const [mailNote, setMailNote] = useState('');
  const [mailSending, setMailSending] = useState(false);
  const [mailMsg, setMailMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const card = await getClientStatus(id);
        if (cancelled) return;
        setSelected(card);
        setEditForm({
          externalBookingId: card.externalBookingId || '',
          notes: card.notes || '',
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const bookingId = editForm.externalBookingId.trim();
    if (!bookingId) {
      setError('Booking ID is required for onboarding.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateClient(selected.id, {
        externalBookingId: bookingId,
        notes: editForm.notes.trim(),
      });
      setSelected(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function onMailFile(file: File | null) {
    setMailMsg(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMailMsg('Please choose an image file.');
      return;
    }
    try {
      const { base64, mimeType, previewUrl } = await fileToBase64(file);
      setMailBase64(base64);
      setMailMime(mimeType);
      setMailPreview(previewUrl);
    } catch (err) {
      setMailMsg(err instanceof Error ? err.message : 'Could not read photo');
    }
  }

  async function sendMail() {
    if (!selected || !mailBase64) return;
    if (!selected.contactEmail?.trim()) {
      setMailMsg('This client has no contact email.');
      return;
    }
    setMailSending(true);
    setMailMsg(null);
    try {
      const res = await notifyMailReceived(selected.id, mailBase64, mailMime, mailNote);
      setMailMsg(`Email sent to ${res.to}. Mail received: ${res.receivedAtIst}`);
      setMailBase64(null);
      setMailPreview(null);
      setMailNote('');
    } catch (err) {
      setMailMsg(err instanceof Error ? err.message : 'Could not send email');
    } finally {
      setMailSending(false);
    }
  }

  if (busy) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (!selected) {
    return (
      <div>
        <Link to="/staff/find" className="text-sm font-medium" style={{ color: '#134b7f' }}>
          ← Back
        </Link>
        <p className="mt-4 text-sm text-red-600">{error || 'Client not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/staff/find" className="text-sm font-medium hover:underline" style={{ color: '#134b7f' }}>
          ← Back
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{selected.companyName}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              selected.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {selected.isActive ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <DetailRow label="Contact" value={selected.contactPersonName || '—'} />
        <DetailRow label="Email" value={selected.contactEmail} />
        <DetailRow label="Phone" value={selected.contactPhone} />
      </section>

      {canWriteClients(role) && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Onboarding fields
          </h2>
          {editing ? (
            <form onSubmit={saveEdit} className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Booking ID *</label>
                <input
                  className="form-input"
                  value={editForm.externalBookingId}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, externalBookingId: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  className="form-input min-h-[88px]"
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                  onClick={() => {
                    setEditing(false);
                    setEditForm({
                      externalBookingId: selected.externalBookingId || '',
                      notes: selected.notes || '',
                    });
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-3">
              <DetailRow label="Booking ID" value={selected.externalBookingId || '—'} />
              <DetailRow label="Notes" value={selected.notes || '—'} />
              <button
                type="button"
                className="mt-3 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setEditing(true)}
              >
                Edit Booking ID &amp; notes
              </button>
            </div>
          )}
        </section>
      )}

      {canNotifyMail(role) && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Incoming mail
          </h2>
          <p className="text-sm text-slate-500">
            Upload a photo of mail and email the client. Received time is set when you send.
          </p>
          {!selected.contactEmail ? (
            <p className="text-sm text-red-600">
              No contact email on file — ask staff to add one before sending.
            </p>
          ) : (
            <p className="text-sm text-slate-500">Will send to {selected.contactEmail}</p>
          )}

          {mailPreview ? (
            <img
              src={mailPreview}
              alt="Mail preview"
              className="max-h-56 rounded-lg border border-slate-200 object-contain"
            />
          ) : (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
              No photo yet
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Photo *</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="block w-full text-sm text-slate-600"
              onChange={(e) => onMailFile(e.target.files?.[0] || null)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Note (optional)</label>
            <input
              className="form-input"
              placeholder="e.g. Courier envelope, needs signature"
              value={mailNote}
              onChange={(e) => setMailNote(e.target.value)}
            />
          </div>
          {mailMsg && (
            <p
              className={`text-sm ${mailMsg.startsWith('Email sent') ? 'text-green-700' : 'text-red-600'}`}
              role="status"
            >
              {mailMsg}
            </p>
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={!mailBase64 || mailSending || !selected.contactEmail}
            onClick={sendMail}
          >
            {mailSending ? 'Sending…' : 'Send email to client'}
          </button>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <DetailRow label="Address" value={selected.address} />
        <DetailRow
          label="Agreement"
          value={`${fmtDate(selected.contractStartDate)} → ${fmtDate(selected.contractEndDate)}`}
        />
        <DetailRow label="Location" value={selected.location?.name} />
        <DetailRow label="Vendor" value={selected.vendor?.name} />
        <DetailRow label="Membership" value={selected.membershipType} />
        {!canWriteClients(role) && (
          <>
            <DetailRow label="Booking ID" value={selected.externalBookingId} />
            <DetailRow label="Notes" value={selected.notes} />
          </>
        )}
        <DetailRow label="Title" value={selected.contactPersonTitle} />
        <DetailRow label="Alt phone" value={selected.contactPersonPhone} />
        <DetailRow label="City" value={selected.city} />
        <DetailRow label="State" value={selected.state} />
        <DetailRow label="ZIP" value={selected.zipCode} />
        <DetailRow label="Country" value={selected.country} />
        <DetailRow label="PAN" value={selected.taxId} />
        <DetailRow label="GST" value={selected.gstNumber} />
        <DetailRow label="Office type" value={selected.officeType} />
        <DetailRow label="Lead source" value={selected.leadSource} />
        <DetailRow label="Channel" value={selected.clientChannel} />
        <DetailRow label="Aggregator" value={selected.aggregatorName} />
        <DetailRow label="Contract months" value={selected.contractMonths} />
        <DetailRow label="Onboarding" value={selected.onboardingStage} />
        <DetailRow label="Renewal" value={selected.renewalStatus} />
        {selected.renewalDate ? (
          <DetailRow label="Renewal date" value={fmtDate(selected.renewalDate)} />
        ) : null}
        <DetailRow
          label="KYC"
          value={
            selected.kycCompleted === undefined || selected.kycCompleted === null
              ? null
              : selected.kycCompleted
          }
        />
      </section>

      {canSeeMoney(role) && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Rate card (excl. GST)
          </h2>
          <p className="text-sm text-slate-500">
            Vendor: {selected.vendor?.name || selected.vendor?.code || '—'}
          </p>
          {selected.applicableRate ? (
            <p className="text-sm font-semibold text-slate-900">
              Applicable ({selected.applicableRate.membershipType}): ₹
              {selected.applicableRate.rateExclusive}
            </p>
          ) : selected.membershipType ? (
            <p className="text-sm text-slate-500">
              No exact rate match for “{selected.membershipType}”
            </p>
          ) : (
            <p className="text-sm text-slate-500">Client has no membership type</p>
          )}
          {selected.rateCard?.length ? (
            selected.rateCard.map((r) => (
              <p key={r.membershipType} className="text-sm text-slate-800">
                {r.membershipType}: ₹{r.rateExclusive}
              </p>
            ))
          ) : (
            <p className="text-sm text-slate-500">No vendor rate card on file</p>
          )}
          <DetailRow label="Legacy charges" value={selected.legacyCharges} />
          <DetailRow label="Legacy payment status" value={selected.legacyPaymentStatus} />

          {selected.payments?.length ? (
            <div className="pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recent payments
              </p>
              {selected.payments.map((p) => (
                <p key={p.id} className="text-sm text-slate-800">
                  ₹{p.amount} · {p.status}
                </p>
              ))}
            </div>
          ) : null}
          {selected.invoices?.length ? (
            <div className="pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recent invoices
              </p>
              {selected.invoices.map((inv) => (
                <p key={inv.id} className="text-sm text-slate-800">
                  {inv.invoiceNumber} · ₹{inv.totalAmount}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
