import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Colleague, TicketDetail, TicketEvent, TicketStatus } from '../../services/tickets';

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN');
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const open = status === 'IN_PROGRESS';
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        open ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
      }`}
    >
      {open ? 'In progress' : 'Closed'}
    </span>
  );
}

function eventTitle(event: TicketEvent): string {
  switch (event.type) {
    case 'CREATED':
      return 'Ticket created';
    case 'ASSIGNED':
      return 'Assignment';
    case 'COMMENTED':
      return 'Internal note';
    case 'STATUS_CHANGED':
      return 'Status change';
    case 'EMAIL':
      return 'Email';
    case 'ATTACHMENT':
      return 'File added';
    default:
      return event.type;
  }
}

function eventBody(event: TicketEvent): string {
  const details = event.details ?? {};
  if (event.type === 'COMMENTED') return String(details.body ?? '');
  if (event.type === 'STATUS_CHANGED') {
    return [
      details.from && details.to ? `${details.from} → ${details.to}` : '',
      details.resolutionNotes ? `Resolution: ${details.resolutionNotes}` : '',
      details.reason ? `Reason: ${details.reason}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (event.type === 'ASSIGNED') {
    if (details.automatic) {
      return details.assigneeId ? 'Assigned from the issue-group route' : 'Placed in the branch queue';
    }
    return [details.from ? `From ${details.from}` : 'From the queue', details.to ? `To ${details.to}` : '', details.reason ? String(details.reason) : '']
      .filter(Boolean)
      .join(' · ');
  }
  if (event.type === 'EMAIL') {
    const to = Array.isArray(details.to) ? details.to.join(', ') : '';
    return [String(details.kind ?? ''), String(details.status ?? ''), to, details.reason ? String(details.reason) : '']
      .filter(Boolean)
      .join(' · ');
  }
  if (event.type === 'ATTACHMENT') return String(details.fileName ?? '');
  if (event.type === 'CREATED') return [details.issueGroup, details.location].filter(Boolean).join(' · ');
  return '';
}

export default function TicketWorkspace({
  ticket,
  colleagues,
  backTo,
  allowReopen,
  onComment,
  onTake,
  onAssign,
  onClose,
  onReopen,
  onUpload,
  onOpenFile,
}: {
  ticket: TicketDetail;
  colleagues: Colleague[];
  backTo: string;
  allowReopen: boolean;
  onComment: (body: string) => Promise<void>;
  onTake: () => Promise<void>;
  onAssign: (assigneeId: string, reason: string) => Promise<void>;
  onClose: (resolutionNotes: string) => Promise<void>;
  onReopen?: (reason: string) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  onOpenFile: (attachmentId: string) => Promise<void>;
}) {
  const open = ticket.status === 'IN_PROGRESS';
  const [comment, setComment] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [reason, setReason] = useState('');
  const [resolution, setResolution] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  function submitComment(event: FormEvent) {
    event.preventDefault();
    const body = comment.trim();
    if (!body) return;
    void run('comment', async () => {
      await onComment(body);
      setComment('');
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={backTo} className="text-sm font-medium hover:underline" style={{ color: '#134b7f' }}>
          ← Tickets
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{ticket.ticketNumber}</h1>
          <StatusBadge status={ticket.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {ticket.location.name} · {ticket.issueGroup.name} · {formatWhen(ticket.createdAt)}
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
        <Field label="Customer" value={ticket.customerName} />
        <Field label="Company" value={ticket.companyName} />
        <Field label="Email" value={ticket.customerEmail || 'Not provided'} />
        <Field label="Phone" value={ticket.customerPhone || 'Not provided'} />
        <Field label="Department" value={ticket.department?.name || 'Unassigned'} />
        <Field label="Assigned to" value={ticket.assignee?.name || 'Branch queue'} />
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{ticket.issueDescription}</p>
        </div>
        {ticket.resolutionNotes && (
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resolution</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{ticket.resolutionNotes}</p>
            <p className="mt-1 text-xs text-slate-500">
              Closed {formatWhen(ticket.closedAt)}
              {ticket.closedBy ? ` by ${ticket.closedBy}` : ''}
            </p>
          </div>
        )}
      </section>

      {ticket.attachments.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Files</h2>
          <ul className="mt-3 space-y-2">
            {ticket.attachments.map((file) => (
              <li key={file.id}>
                <button
                  type="button"
                  className="text-sm font-medium hover:underline"
                  style={{ color: '#134b7f' }}
                  onClick={() => void run(`file-${file.id}`, () => onOpenFile(file.id))}
                >
                  {file.fileName}
                </button>
                <span className="ml-2 text-xs text-slate-400">{Math.ceil(file.sizeBytes / 1024)} KB</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {open && (
        <section className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={submitComment} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Internal note</h2>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Visible to the support team only"
            />
            <button
              type="submit"
              disabled={busy === 'comment'}
              className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: '#134b7f' }}
            >
              Add note
            </button>
          </form>

          <div className="space-y-4">
            {!ticket.assignee && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Branch queue</h2>
                <p className="mt-1 text-sm text-slate-500">This ticket is waiting for someone at the desk.</p>
                <button
                  type="button"
                  disabled={busy === 'take'}
                  onClick={() => void run('take', onTake)}
                  className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: '#134b7f' }}
                >
                  Take this ticket
                </button>
              </div>
            )}

            <form
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                if (!assigneeId || reason.trim().length < 3) return;
                void run('assign', async () => {
                  await onAssign(assigneeId, reason.trim());
                  setReason('');
                });
              }}
            >
              <h2 className="text-sm font-semibold text-slate-900">Hand over</h2>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Choose a teammate</option>
                {colleagues.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy === 'assign'}
                className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
              >
                Reassign
              </button>
            </form>

            <form
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                if (resolution.trim().length < 3) return;
                void run('close', () => onClose(resolution.trim()));
              }}
            >
              <h2 className="text-sm font-semibold text-slate-900">Close ticket</h2>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={3}
                placeholder="What was done?"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy === 'close'}
                className="mt-3 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Mark closed
              </button>
            </form>

            <label className="block rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
              <span className="font-semibold text-slate-900">Add a file</span>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="mt-2 block w-full text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  void run('upload', () => onUpload(file));
                }}
              />
            </label>
          </div>
        </section>
      )}

      {!open && allowReopen && onReopen && (
        <form
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (reopenReason.trim().length < 3) return;
            void run('reopen', () => onReopen(reopenReason.trim()));
          }}
        >
          <h2 className="text-sm font-semibold text-slate-900">Reopen</h2>
          <p className="mt-1 text-sm text-slate-500">
            This note is included in the customer email when an email address exists.
          </p>
          <input
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Reason"
          />
          <button
            type="submit"
            disabled={busy === 'reopen'}
            className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: '#134b7f' }}
          >
            Reopen ticket
          </button>
        </form>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Activity</h2>
        <ol className="mt-4 space-y-4">
          {ticket.events.map((event) => (
            <li key={event.id} className="border-l-2 border-slate-200 pl-3">
              <p className="text-sm font-medium text-slate-900">{eventTitle(event)}</p>
              <p className="text-xs text-slate-500">
                {formatWhen(event.createdAt)}
                {event.actorName ? ` · ${event.actorName}` : ''}
              </p>
              {eventBody(event) && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{eventBody(event)}</p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value}</p>
    </div>
  );
}
