import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isAuthenticated, getCurrentUser } from '../services/auth';

/** Roles allowed to access admin routes. */
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'];

/**
 * Protects child routes: requires authentication and an admin role (ADMIN, SUPER_ADMIN, or MANAGER).
 * Redirects to /login if not authenticated or if user is not an admin.
 */
export default function AdminRoute() {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }
  const user = getCurrentUser();
  const isAdmin = user?.role && ADMIN_ROLES.includes(user.role);
  if (!isAdmin) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}
