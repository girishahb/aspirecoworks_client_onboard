import { Navigate, Outlet } from 'react-router-dom';
import { isSuperAdmin } from '../auth/storage';

/**
 * Guard for admin routes. Only SUPER_ADMIN can access /admin/*.
 * Non-admin users are redirected to /dashboard.
 */
export function AdminGuard() {
  if (!isSuperAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
