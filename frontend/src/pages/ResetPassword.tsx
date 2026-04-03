import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { resetPassword } from '../services/auth';

export default function ResetPassword() {
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
      setError('Invalid or expired link. Please request a new reset link.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div>
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Reset Password</h1>
          <p className="text-sm text-slate-500">
            This link is invalid or has expired. Please request a new one.
          </p>
        </div>
        <div className="flex gap-3 text-sm font-medium" style={{ color: '#134b7f' }}>
          <Link to="/forgot-password" className="hover:underline">Request new link</Link>
          <span className="text-slate-300">·</span>
          <Link to="/login" className="hover:underline">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Set a new password</h1>
        <p className="text-sm text-slate-500">Enter a new password for your account below.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
            className="form-input"
            placeholder="••••••••"
            required
            minLength={6}
            autoComplete="new-password"
            disabled={loading}
          />
          <p className="mt-1 text-xs text-slate-400">Minimum 6 characters</p>
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="form-input"
            placeholder="••••••••"
            required
            minLength={6}
            autoComplete="new-password"
            disabled={loading}
          />
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary mt-1">
          {loading ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
    </div>
  );
}
