import { type FormEvent, useEffect, useState } from 'react';
import {
  createIssueGroup,
  createQrCode,
  downloadQrImage,
  downloadQrPoster,
  downloadAllQrPosters,
  getSupportSettings,
  regenerateQrCode,
  saveIssueRoute,
  setQrActive,
  setReceptionHome,
  updateIssueGroup,
  type SupportSettings,
} from '../services/tickets';

function splitEmails(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

export default function AdminTicketSettings() {
  const [settings, setSettings] = useState<SupportSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [qrLocationId, setQrLocationId] = useState('');
  const [qrLabel, setQrLabel] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setSettings(await getSupportSettings());
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : 'Could not load settings'));
  }, []);

  async function run(action: () => Promise<SupportSettings | void>) {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      if (next) setSettings(next);
      else await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return <p className="text-sm text-slate-400">{error || 'Loading…'}</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ticket setup</h1>
        <p className="text-sm text-slate-500">
          Issue groups, who gets the email, QR codes for each branch, and which desk a receptionist covers.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">QR codes</h2>
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-white"
            style={{ background: '#134b7f' }}
            onClick={() => void downloadAllQrPosters()}
          >
            Download all A4 posters
          </button>
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            if (!qrLocationId) return;
            void run(async () => {
              await createQrCode(qrLocationId, qrLabel.trim() || undefined);
              setQrLabel('');
            });
          }}
        >
          <select
            value={qrLocationId}
            onChange={(e) => setQrLocationId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Location</option>
            {settings.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          <input
            value={qrLabel}
            onChange={(e) => setQrLabel(e.target.value)}
            placeholder="Label, e.g. Reception"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <button type="submit" disabled={busy} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-900">
            Create QR
          </button>
        </form>
        <ul className="space-y-2">
          {settings.qrCodes.map((code) => (
            <li key={code.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {code.label} · {code.locationName}
                  </p>
                  <p className="mt-1 break-all text-slate-500">{code.url}</p>
                </div>
                <span className={code.isActive ? 'text-green-700' : 'text-slate-400'}>
                  {code.isActive ? 'Active' : 'Disabled'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded px-2 py-1 text-white"
                  style={{ background: '#134b7f' }}
                  onClick={() => void downloadQrPoster(code.id, `${code.locationName}-support-poster.pdf`)}
                >
                  A4 poster
                </button>
                <button type="button" className="rounded border border-slate-300 px-2 py-1" onClick={() => void downloadQrImage(code.id, 'png', `${code.label}.png`)}>
                  PNG
                </button>
                <button type="button" className="rounded border border-slate-300 px-2 py-1" onClick={() => void downloadQrImage(code.id, 'svg', `${code.label}.svg`)}>
                  SVG
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1"
                  onClick={() => void run(() => setQrActive(code.id, !code.isActive))}
                >
                  {code.isActive ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1"
                  onClick={() => void run(() => regenerateQrCode(code.id).then(() => undefined))}
                >
                  Regenerate
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Issue groups and email</h2>
        <p className="text-sm text-slate-500">
          Leave the default person empty so each branch queue keeps its own tickets. A person is used only when their home branch matches the ticket, or they have no home branch.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (groupName.trim().length < 2) return;
            void run(async () => {
              const next = await createIssueGroup(groupName.trim());
              setGroupName('');
              return next;
            });
          }}
        >
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="New issue group"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-900">
            Add
          </button>
        </form>
        {settings.groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            departments={settings.departments}
            receptionUsers={settings.receptionUsers}
            disabled={busy}
            onSave={(body) => run(() => saveIssueRoute(group.id, body))}
            onToggle={() => run(() => updateIssueGroup(group.id, { isActive: !group.isActive }))}
          />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Reception home branch</h2>
        <p className="text-sm text-slate-500">A receptionist sees tickets for this branch on their Staff Ops desk.</p>
        <ul className="space-y-2">
          {settings.receptionUsers.map((user) => (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
              <div>
                <p className="font-medium text-slate-900">{user.name}</p>
                <p className="text-slate-500">{user.email}</p>
              </div>
              <select
                value={user.homeLocationId ?? ''}
                onChange={(e) =>
                  void run(() => setReceptionHome(user.id, e.target.value || null))
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <option value="">All branches</option>
                {settings.locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function GroupCard({
  group,
  departments,
  receptionUsers,
  disabled,
  onSave,
  onToggle,
}: {
  group: SupportSettings['groups'][number];
  departments: SupportSettings['departments'];
  receptionUsers: SupportSettings['receptionUsers'];
  disabled: boolean;
  onSave: (body: {
    departmentId: string;
    defaultAssigneeId?: string | null;
    toEmails: string[];
    ccEmails: string[];
  }) => void;
  onToggle: () => void;
}) {
  const [departmentId, setDepartmentId] = useState(group.route?.departmentId || departments[0]?.id || '');
  const [assigneeId, setAssigneeId] = useState(group.route?.defaultAssigneeId || '');
  const [to, setTo] = useState(group.route?.toEmails.join(', ') || '');
  const [cc, setCc] = useState(group.route?.ccEmails.join(', ') || '');

  return (
    <form
      className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (!departmentId) return;
        onSave({
          departmentId,
          defaultAssigneeId: assigneeId || null,
          toEmails: splitEmails(to),
          ccEmails: splitEmails(cc),
        });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-slate-900">{group.name}</h3>
        <button type="button" onClick={onToggle} className="text-xs text-slate-600 underline">
          {group.isActive ? 'Disable' : 'Enable'}
        </button>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <option value="">No default person</option>
          {receptionUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To emails, separated by commas" className="rounded-lg border border-slate-200 bg-white px-3 py-2" />
        <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="CC emails" className="rounded-lg border border-slate-200 bg-white px-3 py-2" />
      </div>
      <button type="submit" disabled={disabled} className="mt-3 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60">
        Save route
      </button>
    </form>
  );
}
