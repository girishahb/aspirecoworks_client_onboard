import { useEffect, useState } from 'react';
import {
  createAggregatorUser,
  listAggregatorUsers,
  resendAggregatorInvite,
  type AggregatorUser,
} from '../services/aggregatorUsers';

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function AdminAggregatorUsers() {
  const [users, setUsers] = useState<AggregatorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await listAggregatorUsers();
      setUsers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load aggregator users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleResend(id: string) {
    setResendingId(id);
    setNotice(null);
    try {
      const res = await resendAggregatorInvite(id);
      setNotice(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invite');
    } finally {
      setResendingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Aggregator Users</h1>
          <p className="text-sm text-slate-500 mt-1">
            Partners that onboard clients on behalf of Aspire Coworks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium shadow-sm hover:opacity-90"
        >
          + Add aggregator user
        </button>
      </div>

      {notice && (
        <div className="mb-4 p-3 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-5 py-3">Aggregator name</th>
                <th className="text-left px-5 py-3"># Clients</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Created</th>
                <th className="text-left px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="px-5 py-3 text-slate-700">{u.email}</td>
                  <td className="px-5 py-3 text-slate-700">{u.aggregatorName ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-700">{u.clientsCount ?? 0}</td>
                  <td className="px-5 py-3">
                    <span
                      style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: 999,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: u.isActivated ? '#ecfdf5' : '#fff7ed',
                        color: u.isActivated ? '#065f46' : '#9a3412',
                      }}
                    >
                      {u.isActivated ? 'Active' : 'Invited'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{formatDate(u.createdAt)}</td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => handleResend(u.id)}
                      disabled={resendingId === u.id || u.isActivated}
                      className="text-primary text-sm font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resendingId === u.id ? 'Sending…' : 'Resend invite'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && !error && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                    No aggregator users yet.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-center text-sm text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <CreateAggregatorModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            setNotice('Aggregator user created and invite email sent.');
            void load();
          }}
        />
      )}
    </div>
  );
}

function CreateAggregatorModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [aggregatorName, setAggregatorName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await createAggregatorUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        aggregatorName: aggregatorName.trim(),
      });
      onCreated();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to create aggregator user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Add aggregator user</h2>
        <p className="text-sm text-slate-500 mb-4">
          An invite email will be sent so the user can set their password.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">First name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="form-input"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="form-input"
                disabled={submitting}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
              disabled={submitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Aggregator name</label>
            <input
              type="text"
              value={aggregatorName}
              onChange={(e) => setAggregatorName(e.target.value)}
              required
              placeholder="e.g. MyHQ, Awfis, CoFynd"
              className="form-input"
              disabled={submitting}
            />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create and send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
