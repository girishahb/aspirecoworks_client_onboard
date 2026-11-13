import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPublicTicketForm, submitPublicTicket } from '../services/tickets';

const REQUEST_KEY = 'acw-ticket-request-id';

function requestId(): string {
  const existing = sessionStorage.getItem(REQUEST_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(REQUEST_KEY, id);
  return id;
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      resolve(raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw);
    };
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

export default function RaiseTicket() {
  const [params] = useSearchParams();
  const token = params.get('t')?.trim() || '';
  const [locationName, setLocationName] = useState('');
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [loadingForm, setLoadingForm] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [issueGroupId, setIssueGroupId] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ticketNumber: string; message: string } | null>(null);
  const websiteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) {
      setLoadingForm(false);
      setFormError('Scan the QR code at your Aspire Coworks branch to raise a ticket.');
      return;
    }
    let cancelled = false;
    setLoadingForm(true);
    getPublicTicketForm(token)
      .then((res) => {
        if (cancelled) return;
        setLocationName(res.locationName);
        setGroups(res.groups);
        setFormError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setFormError(err instanceof Error ? err.message : 'This QR code could not be opened');
      })
      .finally(() => {
        if (!cancelled) setLoadingForm(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let attachment: { fileName: string; contentBase64: string } | undefined;
      if (file) {
        if (file.size > 4 * 1024 * 1024) {
          throw new Error('Attachment must be 4 MB or smaller');
        }
        attachment = { fileName: file.name, contentBase64: await readFile(file) };
      }
      const result = await submitPublicTicket({
        token,
        customerName,
        companyName,
        issueGroupId,
        issueDescription,
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        clientRequestId: requestId(),
        website: websiteRef.current?.value || '',
        attachment,
      });
      sessionStorage.removeItem(REQUEST_KEY);
      setDone(result);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit the ticket');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-2.5 px-4">
          <img src="/logo.png" alt="Aspire Coworks" className="h-8 w-8 object-contain" />
          <div>
            <div className="text-sm font-bold tracking-wide" style={{ color: '#134b7f' }}>
              ASPIRE COWORKS
            </div>
            <div className="text-[11px] text-slate-500">Support request</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {loadingForm && <p className="text-sm text-slate-500">Loading…</p>}

        {!loadingForm && formError && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">Raise a ticket</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{formError}</p>
          </div>
        )}

        {!loadingForm && !formError && done && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{locationName}</p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">Ticket registered</h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-700">{done.message}</p>
            <p className="mt-4 rounded-xl bg-[#e8f1f8] px-4 py-3 text-center text-lg font-bold tracking-wide text-[#134b7f]">
              {done.ticketNumber}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Keep this number. Quote it at reception if you need to follow up.
            </p>
          </div>
        )}

        {!loadingForm && !formError && !done && (
          <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{locationName}</p>
              <h1 className="mt-1 text-xl font-bold text-slate-900">Raise a support ticket</h1>
              <p className="mt-1 text-sm text-slate-500">Tell us what needs attention. No login required.</p>
            </div>

            <label className="block text-sm">
              <span className="font-medium text-slate-800">Your name</span>
              <input
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5"
                autoComplete="name"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-800">Company name</span>
              <input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5"
                autoComplete="organization"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-800">Issue</span>
              <select
                required
                value={issueGroupId}
                onChange={(e) => setIssueGroupId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5"
              >
                <option value="">Select an issue</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-800">What happened?</span>
              <textarea
                required
                minLength={5}
                rows={4}
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-800">Email</span>
              <span className="ml-1 font-normal text-slate-400">optional</span>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5"
                autoComplete="email"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Add an email if you want a confirmation and a message when the ticket is closed.
              </span>
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-800">Phone</span>
              <span className="ml-1 font-normal text-slate-400">optional</span>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5"
                autoComplete="tel"
                inputMode="tel"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-800">Photo or PDF</span>
              <span className="ml-1 font-normal text-slate-400">optional, 4 MB</span>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="mt-1 block w-full text-sm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <input
              ref={websiteRef}
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />

            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: '#134b7f' }}
            >
              {submitting ? 'Submitting…' : 'Submit ticket'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
