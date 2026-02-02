import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { apiGet } from '../api/client';
import { setStoredRole } from './storage';

const TOKEN_KEY = 'token';

interface VerifyLoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

function getRedirectForRole(role: string): string {
  if (role === 'SUPER_ADMIN') return '/admin/companies';
  if (role === 'COMPANY_ADMIN') return '/onboarding';
  return '/dashboard';
}

export function AuthVerifyPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token?.trim()) {
      setLoading(false);
      setError('Missing sign-in link. Request a new one from the login page.');
      return;
    }

    let cancelled = false;

    apiGet<VerifyLoginResponse>(
      `/auth/verify-login?token=${encodeURIComponent(token)}`,
    )
      .then((data) => {
        if (cancelled) return;
        localStorage.setItem(TOKEN_KEY, data.access_token);
        if (data.user?.role) {
          setStoredRole(data.user.role);
        }
        const redirect = getRedirectForRole(data.user?.role ?? '');
        window.location.replace(redirect);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Invalid or expired sign-in link.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <p className="text-stone-500">Signing you in…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-8 shadow-sm text-center">
        <h1 className="text-xl font-semibold text-stone-900">Sign-in failed</h1>
        <p className="mt-2 text-sm text-stone-600">{error}</p>
        <Link
          to="/login"
          className="mt-6 inline-block rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
