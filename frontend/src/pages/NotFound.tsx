import { Link } from 'react-router-dom';
import { getCurrentUser } from '../services/auth';

/**
 * 404 / Page not found.
 * Shown when the user navigates to a route that doesn't exist.
 * Provides links to dashboard or login based on auth state.
 */
export default function NotFound() {
  const user = getCurrentUser();
  const isAdmin = user?.role && ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role);

  return (
    <div className="text-center py-12">
      <h1 className="text-4xl font-bold text-text mb-2">Page not found</h1>
      <p className="text-muted mb-8">
        The page you're looking for doesn't exist or you may not have permission to access it.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        {user ? (
          <>
            <Link
              to={isAdmin ? '/admin/dashboard' : '/dashboard'}
              className="inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#134b7f' }}
            >
              Go to dashboard
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-text hover:bg-gray-50 transition-colors"
            >
              Sign in again
            </Link>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#134b7f' }}
            >
              Sign in
            </Link>
            <Link
              to="/admin/login"
              className="inline-flex items-center rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-text hover:bg-gray-50 transition-colors"
            >
              Admin sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
