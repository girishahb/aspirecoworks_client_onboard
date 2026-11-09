import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  clearSessionExpired,
  getCurrentUser,
  login,
  logout,
} from '../services/auth';
import { isStaffPortalRole } from '../services/staffOps';

const NON_STAFF_ERROR =
  'Access denied. Use a Front Desk, Onboarding, or Finance account.';

export default function StaffLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionExpired, setSessionExpiredState] = useState(false);

  useEffect(() => {
    if (clearSessionExpired()) setSessionExpiredState(true);
    const user = getCurrentUser();
    if (user && isStaffPortalRole(user.role)) {
      navigate('/staff', { replace: true });
    }
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      const user = getCurrentUser();
      if (user?.role && isStaffPortalRole(user.role)) {
        navigate('/staff', { replace: true });
        return;
      }
      logout();
      setError(NON_STAFF_ERROR);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-7">
        <div
          className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
          style={{ background: 'rgba(19,75,127,0.08)', color: '#134b7f' }}
        >
          Staff Ops
        </div>
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Staff sign in</h1>
        <p className="text-sm text-slate-500">
          For Onboarding, Front Desk &amp; Finance — same accounts as the mobile app.
        </p>
      </div>

      {sessionExpired && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800"
        >
          <strong>Session expired.</strong> Please sign in again.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="staff-email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            id="staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
            placeholder="you@aspirecoworks.com"
            required
            autoComplete="email"
            disabled={loading}
          />
        </div>
        <div>
          <label
            htmlFor="staff-password"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <input
            id="staff-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-input"
            placeholder="••••••••"
            required
            autoComplete="current-password"
            disabled={loading}
          />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} className="btn-primary mt-1">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-slate-400">
        Admin portal?{' '}
        <Link to="/admin/login" className="font-medium hover:underline" style={{ color: '#134b7f' }}>
          Admin login
        </Link>
        {' · '}
        <Link to="/login" className="font-medium hover:underline" style={{ color: '#134b7f' }}>
          Client login
        </Link>
      </p>
    </div>
  );
}
