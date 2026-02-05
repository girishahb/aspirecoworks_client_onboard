import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../services/api';
import { login } from '../services/auth';

const inputClass =
  'block w-full max-w-md rounded-md border border-border bg-white px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60';

export default function Signup() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiPost('/auth/register', {
        email: email.trim(),
        password,
        firstName: companyName.trim(),
        lastName: 'Admin',
      });
      await login(email.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold text-text">Sign up (Company)</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label htmlFor="companyName" className="mb-1 block text-sm font-medium text-text">
            Company name
          </label>
          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className={inputClass}
            required
            autoComplete="organization"
            disabled={loading}
          />
          <p className="mt-1 text-xs text-muted">Your company or organization name.</p>
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-text">
            Admin email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            required
            autoComplete="email"
            disabled={loading}
          />
          <p className="mt-1 text-xs text-muted">Email for the company admin account.</p>
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-text">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            required
            autoComplete="new-password"
            minLength={8}
            disabled={loading}
          />
          <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
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
          {loading ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
    </div>
  );
}
