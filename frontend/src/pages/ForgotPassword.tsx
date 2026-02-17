import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/auth';
import Logo from '../components/Logo';

const inputClass =
  'block w-full max-w-md rounded-lg border border-border bg-white px-3 py-2.5 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary shadow-sm';

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
    <div className="max-w-md mx-auto">
      <div className="mb-8 flex justify-center">
        <Logo to="/" logoSrc="/logo.png" />
      </div>
      <h1 className="text-2xl font-bold text-text mb-1">Forgot password</h1>
      <p className="text-muted text-sm mb-6">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      {success ? (
        <div className="space-y-4">
          <div
            role="alert"
            className="p-4 rounded-lg border border-green-200 bg-green-50 text-green-800 text-sm"
          >
            If an account exists with this email, a reset link has been sent. Check your inbox.
          </div>
          <p className="text-sm text-muted">
            <Link to="/login" className="text-primary hover:underline" style={{ color: '#134b7f' }}>
              Back to Login
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-text">
              Email
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
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
          <p className="text-sm text-muted">
            <Link to="/login" className="text-primary hover:underline" style={{ color: '#134b7f' }}>
              Back to Login
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
