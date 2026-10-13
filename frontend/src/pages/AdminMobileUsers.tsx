import { useEffect, useState } from 'react';
import {
  createMobileOpsUser,
  listMobileOpsUsers,
  setUserActive,
  type MobileOpsUser,
  type MobileOpsRole,
} from '../services/mobileOpsUsers';

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

const ROLE_HINT: Record<MobileOpsRole, string> = {
  RECEPTION: 'Find client + email mail photo to contact',
  STAFF: 'Find/create clients; full profile except payments & rate money',
  FINANCE: 'Full access including payments, invoices & vendor rate cards',
};

export default function AdminMobileUsers() {
  const [users, setUsers] = useState<MobileOpsUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'RECEPTION' as MobileOpsRole,
  });

  async function load() {
    setLoading(true);
    try {
      const data = await listMobileOpsUsers();
      setUsers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mobile users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createMobileOpsUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      setNotice(`Created ${created.role} user ${created.email}. Share the password securely.`);
      setShowModal(false);
      setForm({ firstName: '', lastName: '', email: '', password: '', role: 'RECEPTION' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(u: MobileOpsUser) {
    setTogglingId(u.id);
    setError(null);
    try {
      await setUserActive(u.id, !u.isActive);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mobile users</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create Reception, Staff, and Finance accounts for the Aspire mobile app.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium shadow-sm hover:opacity-90"
        >
          + Add mobile user
        </button>
      </div>

      {notice && (
        <div className="mb-4 p-3 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm" role="alert">
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
                <th className="text-left px-5 py-3">Role</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Created</th>
                <th className="text-left px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    No mobile users yet. Add Reception / Staff / Finance accounts.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                          u.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(u.createdAt)}</td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        disabled={togglingId === u.id}
                        onClick={() => void handleToggle(u)}
                        className="text-sm text-teal-700 hover:underline disabled:opacity-50"
                      >
                        {togglingId === u.id ? '…' : u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Add mobile user</h2>
            <p className="text-xs text-slate-500 mb-4">{ROLE_HINT[form.role]}</p>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm block">
                  <span className="text-slate-600">First name</span>
                  <input
                    required
                    className="mt-1 w-full border rounded-md px-3 py-2"
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  />
                </label>
                <label className="text-sm block">
                  <span className="text-slate-600">Last name</span>
                  <input
                    required
                    className="mt-1 w-full border rounded-md px-3 py-2"
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  />
                </label>
              </div>
              <label className="text-sm block">
                <span className="text-slate-600">Email</span>
                <input
                  required
                  type="email"
                  className="mt-1 w-full border rounded-md px-3 py-2"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </label>
              <label className="text-sm block">
                <span className="text-slate-600">Temporary password (min 8)</span>
                <input
                  required
                  type="text"
                  minLength={8}
                  className="mt-1 w-full border rounded-md px-3 py-2 font-mono text-sm"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Share securely with the staff member"
                />
              </label>
              <label className="text-sm block">
                <span className="text-slate-600">Role</span>
                <select
                  className="mt-1 w-full border rounded-md px-3 py-2"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as MobileOpsRole }))}
                >
                  <option value="RECEPTION">Reception</option>
                  <option value="STAFF">Staff</option>
                  <option value="FINANCE">Finance</option>
                </select>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-md border text-sm"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-primary text-white text-sm font-medium disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? 'Creating…' : 'Create user'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
