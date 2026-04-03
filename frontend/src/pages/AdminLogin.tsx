import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, getCurrentUser, logout, clearSessionExpired } from '../services/auth';

const NON_ADMIN_ERROR = 'Access denied. Admin accounts only.';
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'];

/**
 * Admin login: email + password form, calls existing login API.
 * After login, verifies role === ADMIN; redirects to /admin/dashboard on success.
 * Shows error and logs out if a non-admin logs in.
 */
export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionExpired, setSessionExpiredState] = useState(false);

  useEffect(() => {
    if (clearSessionExpired()) {
      setSessionExpiredState(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      const user = getCurrentUser();
      if (user?.role && ADMIN_ROLES.includes(user.role)) {
        navigate('/admin/dashboard', { replace: true });
        return;
      }
      logout();
      setError(NON_ADMIN_ERROR);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-7">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4"
          style={{ background: 'rgba(19,75,127,0.08)', color: '#134b7f' }}>
          Admin Portal
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Admin sign in</h1>
        <p className="text-sm text-slate-500">Sign in with your admin account to continue.</p>
      </div>
      {sessionExpired && (
        <div role="alert" className="mb-5 p-3.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm">
          <strong>Session expired.</strong> Please sign in again.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="admin-email" className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
            placeholder="admin@aspirecoworks.com"
            required
            autoComplete="email"
            disabled={loading}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="admin-password" className="block text-sm font-medium text-slate-700">Password</label>
            <Link to="/forgot-password" className="text-xs font-medium hover:underline" style={{ color: '#134b7f' }}>
              Forgot password?
            </Link>
          </div>
          <input
            id="admin-password"
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
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary mt-1">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-5 text-center text-xs text-slate-400">
        Not an admin?{' '}
        <Link to="/login" className="font-medium hover:underline" style={{ color: '#134b7f' }}>
          Client login
        </Link>
      </p>
    </div>
  );
}
