import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { setPassword } from '../services/auth';
import Logo from '../components/Logo';

const inputClass =
  'block w-full max-w-md rounded-lg border border-border bg-white px-3 py-2.5 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary shadow-sm';

/** Roles that go to admin dashboard. */
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
      <div className="max-w-md mx-auto">
        <div className="mb-8 flex justify-center">
          <Logo to="/" logoSrc="/logo.png" />
        </div>
        <h1 className="text-2xl font-bold text-text mb-1">Set Password</h1>
        <p className="text-muted text-sm mb-6">
          Invalid or expired link. Please contact your administrator to request a new invite.
        </p>
        <a href="/login" className="text-primary hover:underline" style={{ color: '#134b7f' }}>
          Go to Login
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-8 flex justify-center">
        <Logo to="/" logoSrc="/logo.png" />
      </div>
      <h1 className="text-2xl font-bold text-text mb-1">Set Your Password</h1>
      <p className="text-muted text-sm mb-6">
        You have been onboarded to Aspire Coworks. Create a password to access your account.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-text">
            New password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
            className={inputClass}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={loading}
          />
          <p className="mt-1 text-xs text-muted">Minimum 8 characters</p>
        </div>
        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-text">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={loading}
          />
        </div>
        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f3a66] disabled:opacity-50 transition-colors shadow-sm"
          style={{ backgroundColor: '#134b7f' }}
        >
          {loading ? 'Setting password…' : 'Set Password'}
        </button>
      </form>
    </div>
  );
}
