import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { login, getCurrentUser, clearSessionExpired } from '../services/auth';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const passwordReset = (location.state as { passwordReset?: boolean })?.passwordReset === true;
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
      const role = user?.role;
      let target = '/dashboard';
      if (role && ADMIN_ROLES.includes(role)) target = '/admin/dashboard';
      else if (role === 'AGGREGATOR') target = '/aggregator/dashboard';
      navigate(target, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h1>
        <p className="text-sm text-slate-500">Sign in to your Aspire Coworks account.</p>
      </div>
      {passwordReset && (
        <div role="alert" className="mb-5 p-3.5 rounded-lg border border-green-200 bg-green-50 text-green-800 text-sm">
          Password reset successfully. You can now sign in.
        </div>
      )}
      {sessionExpired && (
        <div role="alert" className="mb-5 p-3.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm">
          <strong>Session expired.</strong> Please sign in again.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
            placeholder="you@company.com"
            required
            autoComplete="email"
            disabled={loading}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
            <Link to="/forgot-password" className="text-xs font-medium hover:underline" style={{ color: '#134b7f' }}>
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
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
      <p className="mt-5 text-center text-sm text-slate-500">
        New to Aspire Coworks?{' '}
        <Link to="/signup" className="font-medium hover:underline" style={{ color: '#134b7f' }}>
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-slate-400">
        Admin?{' '}
        <Link to="/admin/login" className="font-medium hover:underline" style={{ color: '#134b7f' }}>
          Sign in here
        </Link>
      </p>
    </div>
  );
}
