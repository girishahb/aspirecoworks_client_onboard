import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { setPassword } from '../services/auth';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'];

export default function SetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPasswordValue] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid or expired link. Please request a new invite.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const data = await setPassword(token, password);
      const isAdmin = data.user?.role && ADMIN_ROLES.includes(data.user.role);
      navigate(isAdmin ? '/admin/dashboard' : '/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set password');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div>
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Set Password</h1>
          <p className="text-sm text-slate-500">
            This invite link is invalid or has expired. Contact your administrator for a new one.
          </p>
        </div>
        <Link to="/login" className="text-sm font-medium hover:underline" style={{ color: '#134b7f' }}>
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Welcome to Aspire Coworks</h1>
        <p className="text-sm text-slate-500">
          You've been onboarded. Create a password to access your account.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
            New password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
            className="form-input"
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
            disabled={loading}
          />
          <p className="mt-1 text-xs text-slate-400">Minimum 8 characters</p>
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1.5">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="form-input"
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
            disabled={loading}
          />
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary mt-1">
          {loading ? 'Setting password…' : 'Set password & sign in'}
        </button>
      </form>
    </div>
  );
}
