import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/auth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Forgot your password?</h1>
        <p className="text-sm text-slate-500">
          Enter your email and we'll send you a link to reset your password.
        </p>
      </div>

      {success ? (
        <div className="space-y-4">
          <div role="alert" className="p-4 rounded-lg border border-green-200 bg-green-50 text-green-800 text-sm">
            If an account exists with that email, a reset link has been sent. Check your inbox.
          </div>
          <Link to="/login" className="block text-sm font-medium hover:underline" style={{ color: '#134b7f' }}>
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
              Email address
            </label>
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
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary mt-1">
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
          <p className="text-center text-sm text-slate-500">
            <Link to="/login" className="font-medium hover:underline" style={{ color: '#134b7f' }}>
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
