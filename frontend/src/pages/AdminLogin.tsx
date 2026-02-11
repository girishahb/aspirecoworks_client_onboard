import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, getCurrentUser, logout } from '../services/auth';

const NON_ADMIN_ERROR = 'Access denied. Admin accounts only.';
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'];

const inputClass =
  'block w-full max-w-md rounded-md border border-border bg-white px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60';

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
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold text-text">Admin Login</h1>
      <p className="mt-1 text-sm text-muted">Sign in with an admin account.</p>
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
        </div>
        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
