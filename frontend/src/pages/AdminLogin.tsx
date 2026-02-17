import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, getCurrentUser, logout, clearSessionExpired } from '../services/auth';
import Logo from '../components/Logo';

const NON_ADMIN_ERROR = 'Access denied. Admin accounts only.';
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'];

const inputClass =
  'block w-full max-w-md rounded-lg border border-border bg-white px-3 py-2.5 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary shadow-sm disabled:opacity-60';

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
    <div className="max-w-md mx-auto">
      <div className="mb-8 flex justify-center">
        <Logo to="/" logoSrc="/logo.png" />
      </div>
      <h1 className="text-2xl font-bold text-text">Admin sign in</h1>
      <p className="mt-1 text-sm text-muted mb-6">Sign in with an admin account.</p>
      {sessionExpired && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm"
        >
          <strong>Session expired.</strong> Please sign in again to continue.
        </div>
      )}
      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label htmlFor="admin-email" className="mb-1 block text-sm font-medium text-text">
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            required
            autoComplete="email"
            disabled={loading}
          />
          <p className="mt-1 text-xs text-muted">Admin account email.</p>
        </div>
        <div>
          <label htmlFor="admin-password" className="mb-1 block text-sm font-medium text-text">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            required
            autoComplete="current-password"
            disabled={loading}
          />
          <p className="mt-1 text-xs text-muted">Your password.</p>
          <p className="mt-2">
            <Link to="/forgot-password" className="text-sm text-primary hover:underline" style={{ color: '#134b7f' }}>
              Forgot password?
            </Link>
          </p>
        </div>
        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-colors shadow-sm"
          style={{ backgroundColor: '#134b7f' }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
